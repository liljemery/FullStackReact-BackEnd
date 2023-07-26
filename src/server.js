import express from "express";
import {db, DBconnection} from './db.js'
import cors from 'cors';
import fs from 'fs';
import admin from 'firebase-admin';
const  app = express();
app.use(express.json());
//Initializes cors module.
app.use(cors());
var port = 8000;

//Locate firebase credentials
const credentials =  JSON.parse(
    fs.readFileSync('./credentials.json')
)

//Initializes App with firebase credentials.
admin.initializeApp({
    credential: admin.credential.cert(credentials),
})

//Requests user ID from url parameters
app.use( async (req,res,next) =>{
    const { authtoken } = req.headers;

    if(authtoken){
        try{

            req.user = await admin.auth().verifyIdToken(authtoken);

        }catch(e){

            return res.sendStatus(400)

        }
    }
    req.user = req.user || {};

    next();
});


//Calls article content from Database
app.get('/api/articles/:name', async (req,res)=>{
    //Requests user name from url parameters
    const { name } = req.params;

    //Requests user ID
    const { uid } = req.user;

    //Searches article in database
    const article = await db.collection("articles").findOne({ name });

    //if article exists verify if user can upvote
    if(article){
        //Requests upvotes ID array
        const upvoteIDs = article.upvoteIDs || [];
        // User will be able to upvote if his upvote isn't already
        // on upvote array
        article.canUpvote = uid && !upvoteIDs.includes(uid);

        res.json(article)
    }else{
        res.sendStatus(404)
    }
})


//If user is logged, allow to comment and upvote
app.use((req,res,next) =>{
    if(req.user){
        next();
    }else{
        res.sendStatus(401);
    }
})

//Submits one upvote for the article
app.put('/api/articles/:name/upvote', async (req, res)=>{
    //Request the article name
     const { name } = req.params;

    //Requests user ID
     const {uid} = req.user;

    //Searches article in database
     const article = await db.collection("articles").findOne({ name });

    //validate article exists!
     if(article){
        //Requests upvotes ID array
         const upvoteIDs = article.upvoteIDs || [];
        // User will be able to upvote if his upvote isn't already
        // on upvote array
         const canUpvote = uid && !upvoteIDs.includes(uid);

            //If user can upvote, do so
            if(canUpvote){
                await db.collection('articles').updateOne({ name }, {
                    $inc: {upvotes: 1},
                    //Add user's ID to upvote array
                    $push: { upvoteIDs: uid}
                })
            }
            //Searches article on database
            const updatedArticle = await db.collection('articles').findOne({name})
            //Send Article updated to front end
            res.send(updatedArticle)
        }else{
        //If article doesnt exists
        res.send(`This article doesn't exist!`)
     }
})

//Submit a comment to the post
app.post('/api/articles/:name/comments', async (req,res)=>{
    //Requests article name from Request parameters
    const { name } = req.params;

    //Requests comment body from Request parameters
    const { text } = req.body;
    
    //Requests email address from Request parameters
    const { email } = req.user;

    //Testing front end receivables
    // console.log(email,text)

    //Post comment to database
    await db.collection('articles').updateOne({ name }, {
        $push: {comments : {postedBy: email, text: text} },
    })
    
    //Searches article updated from database
    const article = await db.collection('articles').findOne({ name })

    if(article){
        //Returns article updated from database
        res.json(article)
    }else{
        res.send(`This Article doesnt exist`)
    }
})

DBconnection( () => {
    console.log('Succesfully connected to database!')
    app.listen(port, ()=>{
        console.log(`server is listening to http://localhost:${port}`)
     });
})
