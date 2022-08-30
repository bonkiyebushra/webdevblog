import express from 'express';
import bodyParser from 'body-parser';
import showdown from "showdown"
import { pool } from "./dbConfig.js";
import slugify from "slugify"

let converter = new showdown.Converter();

let app = express();

// let getArticles = async () => {
//   return pool.query(`
//   SELECT * FROM articles`
//     , [], (err, results) => {
//       if (err) {

//         return "Error"
//       } else {
//         // 
//         resolve(results)
//       }
//     }
//   )
// }

// let createPost = (title, date, slug, body) => {
//   pool.query(
//     `
//     INSERT INTO articles (title,date,slug,body) 
//     VALUES ($1,$2,$3,$4)
//     RETURNING title,date,slug,body`
//     , [title, date, slug, body], (err, results) => {
//       if (err) {
//         
//       } else {
//         
//       }
//     }
//   )
// }

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

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
        res.render("pages/articles", { articles: results.rows, converter,userType:"admin" })
      }
    }
  )
  // res.render("pages/articles", { articles: articles })
  // res.render("pages/new_post", {})
})

app.post("/blog/new", (req, res) => {
  // 
  // 
  // 
  // json['data'].push({
  //     title: req.body.title,
  //     date:today,
  //     bodySample: req.body.body
  // })
  let { title, sample,body } = req.body;

  // let data = JSON.stringify(json);
  // fs.writeFileSync('articles.json', data);
  // createPost(title, today, slugify(title), body, res)
  pool.query(
    `
    INSERT INTO articles (title,slug,body_sample,body) 
    VALUES ($1,$2,$3,$4)
    RETURNING title,slug,body_sample,body`
    , [title, slugify(title, { lower: true }), sample,body], (err) => { //TODO: Make sure markdown body is encoded correctly
      if (err) {
        console.log(err)
      } else {
        res.redirect("/blog")
      }
    }
  )

})

app.get("/blog/new", (req, res) => {
  res.render("pages/new_post", {})
})

app.get("/blog/edit", (req, res) => {
  pool.query(`
  SELECT * FROM articles ORDER BY publish_date DESC`
    , [], (err, results) => {
      if (err) {
        console.log(err)
      } else {
        res.render("pages/edit_articles", { articles: results.rows })
      }
    }
  )
})

app.get("/blog/:slug/edit/", (req, res) => {

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
          res.render("pages/article/edit", { article, slug })
        } else {
          res.redirect("/blog") //TODO: Toast to show ERROR
        }
      }
    }
  )

})

app.get("/blog/:slug/delete", (req, res) => {
  let slug = req.params['slug']

  pool.query(`
      DELETE FROM articles WHERE slug=$1`, 
      [slug], (err, results) => {
      if(err) {
        console.log(err)
      } else {
        res.redirect("/blog/edit")
      }
  })

})

app.post("/blog/:slug/edit/", (req, res) => {

  let slug = req.params['slug']
  const { body,sample } = req.body
  pool.query(`
        UPDATE articles SET body=$1,body_sample=$2 WHERE slug=$3`
    , [body, sample,slug], (err, results) => {
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

app.post("/blog/:slug/edit/preview",(req,res)=> {
  console.log("Hit")
  // console.log(req.body)
  res.render("pages/article/preview",{preview:"Hello World"})
  // res.redirect("/blog")
})

app.get("/blog/:slug/edit/preview",(req,res)=> {
  console.log("Hi")
})

app.get("/blog/:slug", (req, res) => {
  // let article =
  // let article = json.data[slugs[req.params.id]]
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

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
})