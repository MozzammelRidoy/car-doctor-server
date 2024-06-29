const express = require("express");
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'); 
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();

//middleware
app.use(cors({
  origin : ['http://localhost:5173', 'http://localhost:5174/'],
  credentials : true
}));
app.use(express.json());
app.use(cookieParser()); 


// our middleware

const logger = (req, res, next)=>{
  console.log('loger info', req.method, req.originalUrl); 

  next(); 
}

const verifyToken = async(req, res, next)=> {

  const token = req?.cookies?.token; 
  console.log('token in the middleware',token); 

  if(!token){
    return res.status(401).send({message : 'unauthorized access'}); 
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({message: 'unauthorized access'}); 
    }

    req.user = decoded;
    next(); 

  })



}

// mongo db here

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zmeeuxc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const servicesCollectionDB = client
      .db("carDoctorDB")
      .collection("services");
    const bookingCollectionDB = client.db("carDoctorDB").collection("bookings");

    // auth or token releted api

    app.post('/jwt', async(req, res)=> {

      const user = req.body; 

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn : '1h'}); 



      res.cookie('token', token, {
        httpOnly : true, 
        secure : true,
        sameSite : 'none'
      })
      .send({success : true})
    })

    app.post('/logout', async(req, res)=> {
      const user = req.body; 

      console.log('user logout', user); 

      res.clearCookie('token', {maxAge : 0})
      .send({success : true})
    })


    // service releted api

    app.get("/services", async (req, res) => {
      const filter = req.query; 
      console.log(filter);
      const query = {
        
        title : { $regex : filter.search , $options : 'i' }
        
        
        // price : {$lt : 150, $gt : 30}
      
      }; 

      const options = {
        sort : {
          price : filter.sort === 'asc' ? 1 : -1
        }
      }
      const cursor = servicesCollectionDB.find(query, options);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, service_id: 1, price: 1, img: 1 },
      };

      const result = await servicesCollectionDB.findOne(query, options);

      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      // console.log(booking);
      const result = await bookingCollectionDB.insertOne(booking);
      res.send(result);
    });

    app.get("/bookings/",logger, verifyToken, async (req, res) => {
      // console.log(req.query.email);
      // console.log('coo coo cookies', req.cookies);

      if(req.user.email !== req.query.email){
        return res.status(403).send({message : 'forbidden'})
      }

      let query = {};

      if (req.query?.email) {
        query = { email: req.query.email };
      }

      const result = await bookingCollectionDB.find(query).toArray();
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await bookingCollectionDB.deleteOne(query);

      res.send(result);
    });

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const updateBooking = req.body;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };

      const result = await bookingCollectionDB.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctor Is Running");
});

app.listen(port, () => {
  console.log(`Car Dorcor Server is Running on PORT : ${port}`);
});
