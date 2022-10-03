// import { createRequire } from "module";
// const require = createRequire(import.meta.url)
import dotenv from "dotenv"
import express from 'express';
import bodyParser from 'body-parser';
import showdown from "showdown"
import { pool } from "./dbConfig.js";
import { ROLES } from "./utils/roles.js"
import slugify from "slugify"
import bcrypt from "bcrypt"
import flash from "express-flash"
import session from "express-session"
// import cookieParser from "cookie-parser"
import { initialize as initializePassport } from "./passport_config.js"
import passport from "passport"
import connectPgSimple from "connect-pg-simple"
const pgSession = connectPgSimple(session)

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

initializePassport(passport, async (username) => {
  return new Promise((resolve, reject) => {
    pool.query(`
        SELECT * FROM users WHERE username=$1 LIMIT 1`
      , [username], (err, results) => {
        if (err) {
          console.log(err)
          return reject(err);
        } else {
          resolve(results['rows'][0])
        }
      }
    )
  })
}, (id) => {
  return new Promise((resolve, reject) => {
    pool.query(`
        SELECT * FROM users WHERE id=$1 LIMIT 1`
      , [id], (err, results) => {
        if (err) {
          console.log(err)
          return reject(err);
        } else {
          resolve(results['rows'][0])
        }
      }
    )
  })
});

let app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
// app.use(cookieParser("secret something"))

app.use(session(
  {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
    unset: "destroy",
    store: new pgSession({
      pool: pool,
      tableName: 'user_sessions',
    })
  }
))

app.use(passport.initialize())

// pgSession(passport.session())
// connectPgSimple(passport.session)
app.use(passport.session())
app.use(flash());

const PORT = 3000;
const converter = new showdown.Converter();
app.set('view engine', 'ejs');

app.get("/", (req, res) => {
  res.redirect("/blog")

})

app.get("/user", checkAuthenticated, (req, res) => {
  if (userType(req, res) == ROLES["admin"]) {
    res.redirect("/admin")
  } else {
    res.redirect("editor/blog/manage_posts")
  }
})

app.get("/blog", (req, res) => {
  pool.query(`
  SELECT * FROM articles ORDER BY publish_date DESC`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        let articles = results.rows

        pool.query(`
        SELECT art.title as "article_title",tag."name" as "tag_name"
        FROM
          article_tags a_tags
          JOIN articles art ON ( a_tags.article_id = art.id)
          JOIN tags tag ON ( a_tags.tag_id = tag.id)
        `, [], (err, results) => {
          if (err) {
            console.log(err);
          } else {
            let articlesTags = results.rows;

            articles.forEach((article) => {
              let articleTags = articlesTags.filter((ele) => {
                return ele.article_title == article.title
              })
              article.tags = articleTags
            })
            res.render("pages/articles", { articles, converter, userType: userType(req, res) })

          }
        })
      }
    }
  )
})

app.get("/blog/:slug", (req, res) => {
  let slug = req.params['slug']
  pool.query(`
    SELECT * FROM articles`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        let articles = results.rows
        pool.query(`
        SELECT * FROM articles WHERE slug=$1 LIMIT 1`
          , [slug], (err, results) => {
            if (err) {
              redirect("")
            } else {
              let article = results['rows'][0]
              if (articles && article) {
                pool.query(`
                  SELECT art.title as "article_title",tag."name" as "tag_name"
                  FROM
                    article_tags a_tags
                    JOIN articles art ON ( a_tags.article_id = art.id)
                    JOIN tags tag ON ( a_tags.tag_id = tag.id)
                  WHERE art.title = $1
                  `, [article.title], (err, results) => {
                  if (err) {
                    console.log(err);
                  } else {
                    let articleTags = results.rows;
                    article.tags = articleTags
                    console.log(article)
                    res.render("pages/article/show", { article, articles, converter, userType: userType(req, res) })
                  }
                })

                // console.log(article)
                // res.render("pages/article/show", { article, articles, converter, userType: userType(req, res) })
              } else {
                console.log("Article Doesn't exist")
                res.redirect("/blog") //TODO: Toast to show ERROR
              }
            }
          }
        )
      }
    }
  )
})

// Editor endpoints

app.use("/editor", checkAuthenticated)

app.get("/editor/blog/new", (req, res) => {
  pool.query(`
    SELECT * FROM tags
  `, [], (err, results) => {
    if (err) {
      console.log(err)
    } else {
      res.render("pages/new_post", { userType: userType(req, res), tags: results.rows })
    }
  })
})

app.post("/editor/blog/new", (req, res) => {
  let { title, sample, body, tags } = req.body;
  let slug = slugify(title, { lower: true })
  console.log(req.body)
  pool.query(
    `
    INSERT INTO articles (title,slug,body_sample,body) 
    VALUES ($1,$2,$3,$4)
    RETURNING id`
    , [title, slug, sample, body], (err, results) => { //TODO: Make sure markdown body is encoded correctly
      if (err) {
        console.log(err)
      } else {

        let article = results.rows[0];

        // pool.query(`
        //   SELECT * FROM 
        // `)


        tags.forEach((tag => {
          pool.query(`
          INSERT into article_tags (article_id,tag_id)
          SELECT $1,tag.id 
          FROM tags tag
          WHERE tag.name = $2
        `, [article.id, tag], (err, results) => {
            if (err) {
              console.log(err)
            } else {

            }
          })
        }))

        res.redirect("/blog")
      }
    }
  )
})

app.get("/editor/blog/manage_posts", (req, res) => {
  pool.query(`
  SELECT * FROM articles ORDER BY publish_date DESC`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        res.render("pages/manage_articles", { articles: results.rows, userType: userType(req, res) })
      }
    }
  )
})

app.get("/editor/blog/:slug/edit/", (req, res) => {
  let slug = req.params['slug']

  pool.query(`
        SELECT * FROM articles WHERE slug=$1 LIMIT 1`
    , [slug], (err, results) => {
      if (err) {
        console.log(err)
        redirect("blog")
      } else {
        let article = results['rows'][0]
        if (article) {
          res.render("pages/article/edit", { article, slug, userType: userType(req, res) })
        } else {
          res.redirect("/blog") //TODO: Toast to show ERROR
        }
      }
    }
  )
})

app.post("/editor/blog/:slug/edit/", (req, res) => {
  let slug = req.params['slug']
  const { body, sample } = req.body

  pool.query(`
        UPDATE articles SET body=$1,body_sample=$2 WHERE slug=$3`
    , [body, sample, slug], (err, results) => {
      if (err) {
        console.log(err)
        // redirect("blog")
        //TODO: FIND A WAY TO SHOW TOAST WITH ERRORS-Look into doing it using axaj if form fields are to be persisted
      } else {
        res.redirect("/blog")
      }
    }
  )
})

app.get("/editor/blog/:slug/delete", (req, res) => {
  let slug = req.params['slug']

  pool.query(`
      DELETE FROM articles WHERE slug=$1`,
    [slug], (err) => {
      if (err) {
        console.log(err)
      } else {
        res.redirect("/blog/edit")
      }
    })
})

//*Admin Endpoints

app.use("/admin", checkAdminAuthenticated)

app.get("/admin", (req, res) => {
  res.redirect("/admin/users")
})

app.get("/admin/users", (req, res) => {

  pool.query(`
        SELECT * FROM users`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        res.render("pages/admin/users", { users: results['rows'], userTypes: [...Object.values(ROLES)] })
      }
    }
  )
})

app.get("/admin/users/:username/edit", (req, res) => {
  let username = req.params['username']

  pool.query(`
        SELECT * FROM users WHERE username=$1 LIMIT 1`
    , [username], (err, results) => {
      if (err) {
        redirect(`/admin/users/${username}/edit`)
      } else {
        let user = results['rows'][0]
        if (user) {
          res.render("pages/admin/edit_user", { user, userTypes: Object.values(ROLES) })
        } else {
          console.log("User Doesn't exist")
          res.redirect("/admin/users") //TODO: Toast to show ERROR
        }
      }
    }
  )
  // res.redirect("/admin/users")
})

app.post("/admin/users/:username/edit", (req, res) => {
  let username = req.params['slug']
  const { body, sample } = req.body




  // pool.query(`
  //       UPDATE username SET body=$1,body_sample=$2 WHERE username=$1`
  //   , [username], (err, results) => {
  //     if (err) {
  //       console.log(err)
  //       // redirect("blog")
  //       //TODO: FIND A WAY TO SHOW TOAST WITH ERRORS-Look into doing it using axaj if form fields are to be persisted
  //     } else {
  //       res.redirect("/blog")
  //     }
  //   }
  // )
  res.redirect("/admin/users")
})

app.get("/admin/users/:username/delete", (req, res) => {
  let username = req.params['username']

  pool.query(`
      DELETE FROM users WHERE username=$1`,
    [username], (err) => {
      if (err) {
        console.log(err)
      } else {
        res.redirect("/admin/users")
      }
    })
})

app.post("/admin/users/:username/update_type", (req, res) => {
  let username = req.params['username']
  let { type } = req.body
  console.log(req.body)

  pool.query(`
        UPDATE users SET type=$1 WHERE username=$2`
    , [type, username], (err) => {
      if (err) {
        console.log(err)
        // redirect("blog")
        //TODO: FIND A WAY TO SHOW TOAST WITH ERRORS-Look into doing it using axaj if form fields are to be persisted
      } else {
        console.log("Saved to database")
        res.redirect("/admin/users")
      }
    }
  )
})

// Auth endpoints

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("pages/register")
})

app.post("/register", checkNotAuthenticated, async (req, res, next) => {
  let { first_name: firstName, last_name: lastName, username, email, password, password_confirm: passwordConfirm } = req.body
  try {
    if (password !== passwordConfirm) {
      throw "Passwords do not match";
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    pool.query(`SELECT * FROM users`, [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        let users = results['rows']
        if (users.find((user) => user.username == username)) {
          req.flash("error", "Username is taken")
          res.redirect("/register");
          return;
        }

        if (users.find((user) => user.email == email)) {
          req.flash("error", "Email is already in use")
          res.redirect("/register")
          return;
        }

        pool.query(
          `
            INSERT INTO users (first_name, last_name, username, email, password) 
            VALUES ($1, $2, $3, $4, $5)`
          , [firstName, lastName, username, email, hashedPassword], (err) => { //TODO: Make sure markdown body is encoded correctly
            if (err) {
              console.log(err)
            } else {
              res.redirect("/login")
            }
          }
        )
      }
    }
    )
  } catch (err) {
    console.log("Error occured")
    console.log(err)
    res.redirect("/register")
  }
})

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("pages/login")
})

app.post("/login", checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: "/user", //TODO:Change to user route after creating one. 
  failureRedirect: "/login",
  failureFlash: true
}))

app.get("/logout", (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/login")
  });
})

//Helper functions

//Checks that the user is authenticated(as admin or editor)
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    console.log("User authenticated")
    return next();
  } else {
    console.log("Not logged in");
    res.redirect("/")
  }
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    console.log("User already logged in")
    res.redirect("/")
  } else {
    console.log("Not logged in");
    return next();
  }
}

function checkAdminAuthenticated(req, res, next) {
  if (req.isAuthenticated() && userType(req, res) == ROLES["admin"]) {
    return next()
  }
  console.log("Admin not logged in")
  res.redirect("/")
}

// function checkAuthenticatedAdmin (req,)

function userType(req, res) {
  return req.user?.type?.trim()
}

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})