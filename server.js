import express from 'express';
import bodyParser from 'body-parser';
import loremIpsum from './loremIpsum.js';
import { readFile } from 'fs/promises';
import fs from 'fs';
import showdown from "showdown"
import { pool } from "./dbConfig.js";
import slugify from "slugify"
import { exit } from 'process';
import { resolve } from 'path';

let converter = new showdown.Converter();

const articlesJson = JSON.parse(
  await readFile(
    new URL('./articles.json', import.meta.url)
  )
);

// function promisePractice () {
//   let is_shop_open = false;
//   let promise = new Promise((resolve,reject)=> {
//     if(is_shop_open) {
//       resolve();
//     } else {
//       reject("Shop is closed");
//     }
//   })

//   promise.then(()=> {
//     
//   }).catch(
//     
//   );

// }

// promisePractice();

let app = express();
app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));

let date = new Date();
let today = `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`;

let slugs = {
  "my-first-post": 0,
  "my-second-post": 1,
  "third-post": 2,
  "fourth-post": 3
}

let getArticles = async () => {
  return pool.query(`
  SELECT * FROM articles`
    , [], (err, results) => {
      if (err) {
        
        
        return "Error"
      } else {
        // 
        resolve(results)
        // res.render("pages/articles", { articles: results.rows })
      }
    }
  )
}

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

let json = articlesJson


const PORT = 3000;

// app.use(express.static("public"))

// app.get("/articles",(req,res,next)=>{
//     // 
//     res.json(json)
//     next();
// })

app.set('view engine', 'ejs');



app.get("/", (req, res) => {
  res.redirect("/blog")
})

app.get("/blog", (req, res) => {
  console.log("Hello,This is the web page")
  pool.query(`
  SELECT * FROM articles ORDER BY date DESC`
    , [], (err, results) => {
      if (err) {
        console.log("error")
      } else {
        console.log(results)
        
        res.render("pages/articles", { articles: results.rows,converter })
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
  let { title, body } = req.body;

  // let data = JSON.stringify(json);
  // fs.writeFileSync('articles.json', data);
  // createPost(title, today, slugify(title), body, res)
  pool.query(
    `
    INSERT INTO articles (title,date,slug,body) 
    VALUES ($1,$2,$3,$4)
    RETURNING title,date,slug,body`
    , [title, today, slugify(title, { lower: true }), body], (err) => {
      if (err) {
        
      } else {
        res.redirect("/blog")
      }
    }
  )

})

app.get("/blog/new", (req, res) => {

  res.render("pages/new_post", {})
})

app.get("/blog/edit",(req,res)=> {
  pool.query(`
  SELECT * FROM articles ORDER BY date DESC`
    , [], (err, results) => {
      if (err) {
        
        
      } else {
        res.render("pages/edit_articles", { articles: results.rows })
      }
    }
  )
})

app.get("/blog/:slug/edit/",(req,res)=> {
  
  let slug = req.params['slug']
  pool.query(`
        SELECT * FROM articles WHERE slug=$1 LIMIT 1`
          , [slug], (err, results) => {
            if (err) {
              
              redirect("blog")
            } else {
              let article = results['rows'][0]
              if (article) {
                res.render("pages/article/edit",{article,slug})
              } else {
                res.redirect("/blog") //TODO: Toast to show ERROR
              }
            }
          }
        )
  
})

app.post("/blog/:slug/edit/",(req,res)=> {
  
  let slug = req.params['slug']
  const {body} = req.body
  pool.query(`
        UPDATE articles SET body=$1 WHERE slug=$2`
          , [body,slug], (err, results) => {
            if (err) {
              
              // redirect("blog")
            } else {
              res.redirect("/blog")
              // let article = results['rows'][0]
              // if (article) {
              //   res.render("pages/article/edit",{article})
              // } else {
              //   res.redirect("/blog") //TODO: Toast to show ERROR
              // }
            }
          }
        )
  
})

app.get("/blog/:slug", (req, res) => {
  // let article =
  // let article = json.data[slugs[req.params.id]]
  let slug = req.params['slug']
  pool.query(`
    SELECT * FROM articles`
    , [], (err, results) => {
      if (err) {
        
      } else {
        // 
        let articles = results['rows']
        pool.query(`
        SELECT * FROM articles WHERE slug=$1 LIMIT 1`
          , [slug], (err, results) => {
            if (err) {
              
              redirect("blog")
            } else {
              let article = results['rows'][0]
              if (articles && article) {
                res.render("pages/article/show", { article, articles, converter })
              } else {
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