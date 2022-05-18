const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const cors = require('cors');
app.use(cors())
app.use(express.json())
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r5npa.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req,res,next){
    const accessToken = req.headers.authorization;
    if(!accessToken){
        return res.status(401).send({message:'UnAuthorized access'})
    }
    const token = accessToken.split(' ')[1];
    jwt.verify(token,process.env.ACCESS_TOKEN,function(err,decoded){
        if(err){
            return res.status(403).send({message:'Forbidden access'})
        }
        req.decoded = decoded;
        next()
    })
}

async function run() {
    
    try {
        await client.connect()
        const slotsCollection = client.db("doctors-db").collection("booking-slots")
        const bookingCollection = client.db("doctors-db").collection("users-booking")
        const userCollection = client.db("doctors-db").collection("users")
        const doctorCollection = client.db("doctors-db").collection("doctors")

        const verifyAdmin =async( req,res,next)=>{
            const requester = req.decoded.email;
            const isAdmin = await userCollection.findOne({email:requester});
            if(isAdmin.role === 'admin'){
                next()
            }else{
                return res.status(401).send({message:'Forbidden access'})
            }
        }

        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = slotsCollection.find(query).project({ name: 1 });
            const slots = await cursor.toArray()
            res.send(slots)
        });

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { serviceName: booking.serviceName, date: booking.date, email: booking.email };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, exists })
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result })
        });

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            const services = await slotsCollection.find().toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const bookedServices = bookings.filter(b => b.serviceName === service.name)
                const bookedSlots = bookedServices.map(s => s.slot);
                const available = service.slots.filter(s => !bookedSlots.includes(s));
                service.slots = available;
                service.booked = bookedSlots;

            })
            res.send(services)
        });

        app.get('/mybookings',verifyJWT, async (req, res) => {
            const userEmail = req.query.email;
            const decodedEmail = req.decoded.email;
            if(userEmail===decodedEmail){
                const query = { email: userEmail };
                const myBookings = await bookingCollection.find(query).toArray();
                res.send(myBookings)
            }
            else{
                return res.status(403).send({message:'Forbidden access'})
            }
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '24h' });
            res.send({ result, token })
        });

        app.get('/allusers',verifyJWT, async (req,res)=>{
            const allUsers = await userCollection.find().toArray();
            res.send(allUsers);
        });
        app.put('/user/admin/:email', verifyJWT,verifyAdmin,async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: {role:'admin'},
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send( result )
        });
        app.get('/admin/:email',async(req,res)=>{
            const email = req.params.email;
            const filter = { email: email };
            const isAdmin = await userCollection.find(filter).toArray();
            if(isAdmin[0].role==='admin'){
                res.send(isAdmin)
            }
            else{
                res.status(403).send({message:'Forbidden access'})
            }
        });

        app.post('/addDoctor',verifyJWT,verifyAdmin, async (req, res) => {
            console.log('asdf');
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result)
        })

        

    }
    finally {
    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('server started')
})


app.listen(port, () => {
    console.log(`server running on ${port}`)
})
