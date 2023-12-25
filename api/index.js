const express = require('express');
const cors = require('cors');
const User = require('./models/User');
const { default: mongoose } = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const secret = 'fasdjfy3878fa3y8d38fds';
const cookieParser = require('cookie-parser')
const multer = require('multer')
const uploadMiddleware = multer({ dest:'uploads/'})
const fs = require('fs')
const Post=require('./models/Post')

const app = express();
app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static(__dirname + '/uploads'))

mongoose.connect('mongodb+srv://ayan014iiitm:amCUabuk08QwSqJp@cluster0.qzgavdi.mongodb.net/?retryWrites=true&w=majority')

app.post('/register', async (req,res)=>{
    const {username,password} = req.body;
    try{
        const userDoc = await User.create({username, password:bcrypt.hashSync(password,saltRounds)});
        res.json(userDoc);
    }
    catch(e){
        res.status(400).json(e);
    }
})

app.post('/login', async(req,res)=>{
    const {username,password} = req.body;
    const userDoc = await User.findOne({username});

    if(userDoc===null) res.status(400).json('Wrong credentials');
    else{
        const passOk = bcrypt.compareSync(password, userDoc.password); 
        if(passOk){
            //Logged in
            jwt.sign({username,id:userDoc._id},secret,{},(err,token)=>{
                if(err) throw err;
                res.cookie('token',token).json({
                    id:userDoc._id,
                    username
                });
            })
        }
        else{
            res.status(400).json('Wrong credentials')
        }
    }
    
})

app.get('/profile', (req,res)=>{
    const {token} = req.cookies;
    jwt.verify(token,secret,{},(err,info)=>{
        if(err) throw err;
        res.json(info);
    })
})

app.post('/logout',(req,res)=>{
    res.cookie('token','').json('ok');
})

app.post('/post', uploadMiddleware.single('file'), async(req,res)=>{
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext=parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path,newPath);

    const {token} = req.cookies;
    jwt.verify(token,secret,{}, async(err,info)=>{
        if(err) throw err;
        const {title,summary,content}=req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id, 
        })
        res.json(postDoc);
    })
})

app.put('/post', uploadMiddleware.single('file'), async(req,res)=>{
    let newPath=null;
    if(req.file){
        const {originalname,path} = req.file;
        const parts = originalname.split('.');
        const ext=parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path,newPath);
    }

    const {token} = req.cookies;
    jwt.verify(token,secret,{}, async(err,info)=>{
        if(err) throw err;
        const {id,title,summary,content}=req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if(!isAuthor){
           return res.status(400).json("You are not the author");
        }
        // Update the document in the database
        await Post.findByIdAndUpdate(id, {
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });
        // Fetch the updated document after updating
        const updatedPostDoc = await Post.findById(id);
        res.json(updatedPostDoc);
    })
})

app.get('/post', async(req,res)=>{
    res.json(await Post.find()
    .populate('author',['username'])
    .sort({createdAt: -1})
    .limit(20)
    );
})

app.get('/post/:id', async(req,res)=>{
    const {id} = req.params;
    const postDoc = await Post.findById(id).populate('author',['username']);
    res.json(postDoc);
})

app.delete('/post/:id', async (req, res) => {
    const postId = req.params.id;

    try {
        const { token } = req.cookies;
        const { id: userId } = jwt.verify(token, secret);

        const postDoc = await Post.findById(postId);
        if (!postDoc) {
            return res.status(404).json({ error: "Post not found" });
        }

        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(userId);
        if (!isAuthor) {
            return res.status(401).json({ error: "You are not authorized to delete this post" });
        }

        // If the user is authorized, delete the post
        await Post.findByIdAndDelete(postId);
        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Something went wrong" });
    }
});


app.listen(4000);