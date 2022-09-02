import express from 'express';
import bodyParser from 'body-parser';
import showdown from "showdown"
import { pool } from "./dbConfig.js";
import slugify from "slugify"
import bcrypt from "bcrypt"
import flash from "express-flash"
import session from "express-session"
import cookieParser from "cookie-parser"



let converter = new showdown.Converter();

let app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser("secret something"))
app.use(session({
  cookie: { maxAge: 60000 },
  secret: 'secret cat',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

const PORT = 3000;
app.set('view engine', 'ejs');

app.get("/", (req, res) => {
  res.redirect("/blog")
})

app.get("/blog", (req, res) => {
  pool.query(`
  SELECT * FROM articles ORDER BY publish_date DESC`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        res.render("pages/articles", { articles: results.rows, converter, userType: userType() })
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
        // 
        let articles = results['rows']
        pool.query(`
        SELECT * FROM articles WHERE slug=$1 LIMIT 1`
          , [slug], (err, results) => {
            if (err) {
              redirect("")
            } else {
              let article = results['rows'][0]
              if (articles && article) {
                res.render("pages/article/show", { article, articles, converter })
              } else {
                console.log("Article Doesn't exist")
                console.log(article)
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

app.get("/editor", (req, res) => {
  if ("isLoggedIn") {
    res.redirect("/editor/blog/manage_posts")
  } else {
    res.redirect("/editor/login")
  }
})

app.get("/editor/blog/new", checkAuthenticated, (req, res) => {
  res.render("pages/new_post", { userType: "editor" })
})

app.post("editor/blog/new", checkAuthenticated, (req, res) => {
  let { title, sample, body } = req.body;
  pool.query(
    `
    INSERT INTO articles (title,slug,body_sample,body) 
    VALUES ($1,$2,$3,$4)`
    , [title, slugify(title, { lower: true }), sample, body], (err) => { //TODO: Make sure markdown body is encoded correctly
      if (err) {
        console.log(err)
      } else {
        res.redirect("/blog")
      }
    }
  )
})

app.get("/editor/blog/manage_posts", checkAuthenticated, (req, res) => {
  pool.query(`
  SELECT * FROM articles ORDER BY publish_date DESC`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        res.render("pages/manage_articles", { articles: results.rows, userType: "editor" })
      }
    }
  )
})

app.get("/editor/blog/:slug/edit/", checkAuthenticated, (req, res) => {
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
          res.render("pages/article/edit", { article, slug, userType: "editor" })
        } else {
          res.redirect("/blog") //TODO: Toast to show ERROR
        }
      }
    }
  )
})

app.get("/editor/blog/:slug/delete", checkAuthenticated, (req, res) => {
  let slug = req.params['slug']

  pool.query(`
      DELETE FROM articles WHERE slug=$1`,
    [slug], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        res.redirect("/blog/edit")
      }
    })
})

app.post("/editor/blog/:slug/edit/", checkAuthenticated, (req, res) => {
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

//*Admin Endpoints

app.get("/admin", (req, res) => {
  if ("isLoggedIn") {
    res.redirect("/blog") //TODO: Should eventually lead to admin dashboard
  } else {
    res.redirect("/login")
  }
})


// Auth endpoints

app.get("/register", (req, res) => {
  res.render("pages/register")
})

app.post("/register", async (req, res, next) => {
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

        if (users.find((user) => user.email = email)) {
          req.flash("error", "Email is already in use")
          res.redirect("/register")
          return;
        }

        if (users.find((user) => user.username)) {
          req.flash("error", "Username is taken")
          res.redirect("/register");
          return;
        }

        pool.query(
          `
            INSERT INTO users (first_name, last_name, username, email, password) 
            VALUES ($1, $2, $3, $4, $5)`
          , [firstName, lastName, username, email, password], (err) => { //TODO: Make sure markdown body is encoded correctly
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

app.get("/login", (req, res) => {
  res.render("pages/login")
})

app.post("/login", (req, res) => {
  console.log(req.body)
})

//Helper functions

function checkAuthenticated(req, res, next) {
  let isAuthenticated = true; //TODO:Should be req.isAuthenticated()

  if (isAuthenticated) {
    return next()
  } else {
    res.redirect("/")
  }
}

function userType() {
  let isAuthenticated = true;
  return isAuthenticated ? "editor" : ""
}

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})