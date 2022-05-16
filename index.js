const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
const cors = require('cors');
app.use(cors())
app.use(express.json())
require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.r5npa.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect()
        const slotsCollection = client.db("doctors-db").collection("booking-slots")
        const bookingCollection = client.db("doctors-db").collection("users-booking")


        app.get('/services', async (req, res) => {
            const query = {}
            const cursor = slotsCollection.find(query)
            const slots = await cursor.toArray()
            res.send(slots)
        });

        app.post('/booking' ,async(req,res)=>{
            const booking = req.body;
            const query = {serviceName: booking.serviceName, date:booking.date, email:booking.email};
            const exists = await bookingCollection.findOne(query);
            if(exists){
                return res.send({success: false, exists})
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({success: true, result})
        });

        app.get('/available', async(req, res)=>{
            const date = req.query.date || 'May 16, 2022';
            const services = await slotsCollection.find().toArray();
            const query = {date: date};
            const bookings = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const bookedServices = bookings.filter(b=> b.serviceName === service.name)
                const bookedSlots = bookedServices.map(s=>s.slot);
                const available = service.slots.filter(s=> !bookedSlots.includes(s));
                service.slots = available;
                service.booked = bookedSlots;
                
            })
            res.send(services)
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
