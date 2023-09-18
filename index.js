const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
};
//middleware
app.use(cors(corsConfig));
app.options("", cors(corsConfig));
app.use(express.json());

// mongodb
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.et32bhj.mongodb.net/?retryWrites=true&w=majority`;

// JWT middleware, verify JWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unauthorized acess" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    // console.log(decoded);
    req.decoded = decoded;
    next();
  });
};

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
    // await client.connect();

    const userCollection = client.db("nhSocialDB").collection("users");
    const postCollection = client.db("nhSocialDB").collection("posts");
    const likeCollection = client.db("nhSocialDB").collection("likes");
    const commentCollection = client.db("nhSocialDB").collection("comments");

    // sign jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // User related API's

    // get all user
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get specific one user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // insert a user
    app.post("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // update user profile
    app.put("/updateProfile/:email", async (req, res) => {
      const params_email = req.params.email;
      const {
        name,
        email,
        user_name,
        phone,
        gender,
        website,
        address,
        university,
        about,
        photo,
      } = req.body;
      const filter = { email: params_email };
      const updateUserProfile = {
        $set: {
          name,
          email,
          user_name,
          phone,
          gender,
          website,
          address,
          university,
          about,
        },
      };
      if (photo) {
        updateUserProfile.$set.photo = photo;
      }
      const result = userCollection.updateOne(filter, updateUserProfile);
      res.send(result);
    });

    // POST / STATUS related API's

    // search post by index
    const indexKeys = { post_text: 1, name: 1 };
    const indexOptions = { name: "namePostText" };
    const result = await postCollection.createIndex(indexKeys, indexOptions);

    // get all post and also search by search text
    app.get("/posts", async (req, res) => {
      const searchText = req.query.text;
      const { date } = req.body;

      // Check if searchText is defined and not an empty string
      const query = searchText
        ? {
            $or: [
              { post_text: { $regex: searchText, $options: "i" } },
              { name: { $regex: searchText, $options: "i" } },
            ],
          }
        : {}; // Empty query when searchText is not provided

      const result = await postCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // insert a user post
    app.post("/post", async (req, res) => {
      const post = req.body;
      post.date = new Date();
      const result = await postCollection.insertOne(post);
      res.send(result);
    });

    // get user profile post
    app.get("/my_post/:email", async (req, res) => {
      const email = req.params.email;
      const { date } = req.body;
      const query = { user_email: email };
      const result = await postCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.put("/update_post_author/:email", async (req, res) => {
      const params_email = req.params.email;
      const { name, user_name, user_photo } = req.body;
      const filter = { user_email: params_email };
      const updatePostAuthor = {
        $set: {
          name,
          user_name,
        },
      };
      if (user_photo) {
        updatePostAuthor.$set.user_photo = user_photo;
      }
      const result = postCollection.updateMany(filter, updatePostAuthor);
      res.send(result);
    });

    // update a post
    app.put("/update_post/:id", async (req, res) => {
      const { post_text } = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updatePost = {
        $set: {
          post_text,
        },
      };
      const result = await postCollection.updateOne(query, updatePost);
      res.send(result);
    });
    // delete a post
    app.delete("/remove_post/:id/:user_email", async (req, res) => {
      const id = req.params.id;
      const user_email = req.params.user_email;
      const query = { _id: new ObjectId(id), user_email };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });

    // POST LIKED related API's
    // post a like
    app.post("/like", async (req, res) => {
      const like = req.body;
      const result = await likeCollection.insertOne(like);
      res.send(result);
    });

    // get total likes every post
    app.get("/likes/:postId", async (req, res) => {
      const postId = req.params.postId;
      const pipeline = [
        {
          $match: { postId: postId },
        },
        {
          $group: {
            _id: "$postId",
            totalLikes: { $sum: 1 },
          },
        },
        {
          $project: {
            postId: "$_id",
            totalLikes: 1,
            _id: 0,
          },
        },
      ];

      const result = await likeCollection.aggregate(pipeline).toArray();
      res.send(result[0]);
    });

    // get user-liked which post
    app.get("/userLiked/:user_email", async (req, res) => {
      const user_email = req.params.user_email;

      const likedPosts = await likeCollection
        .find({ email: user_email })
        .project({ postId: 1, _id: 0 })
        .toArray();
      const postIds = likedPosts.map((like) => like.postId);

      const userLikedPosts = await postCollection
        .find({ _id: { $in: postIds.map((postId) => new ObjectId(postId)) } })
        .project({ post_text: 1 }) // Include the fields you want to return
        .toArray();

      res.send(userLikedPosts);
    });

    // remove like
    app.delete("/unlike/:postId/:user_email", async (req, res) => {
      const postId = req.params.postId;
      const user_email = req.params.user_email;
      const query = { postId, email: user_email };
      const result = await likeCollection.deleteOne(query);
      res.send(result);
    });

    // COMMENT RELATED API's
    // post a comment
    app.post("/comment", async (req, res) => {
      const comment = req.body;
      const result = await commentCollection.insertOne(comment);
      res.send(result);
    });

    // get total comment number every post
    app.get("/total_comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const pipeline = [
        {
          $match: { postId: postId },
        },
        {
          $group: {
            _id: "$postId",
            totalComments: { $sum: 1 },
          },
        },
        {
          $project: {
            postId: "$_id",
            totalComments: 1,
            _id: 0,
          },
        },
      ];

      const result = await commentCollection.aggregate(pipeline).toArray();
      res.send(result[0]);
    });

    //  get all comment post wise
    app.get("/comments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const pipeline = [
        {
          $match: { postId: postId },
        },
      ];

      const result = await commentCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    app.put("/update_comment_author/:email", async (req, res) => {
      const params_email = req.params.email;
      const { name, user_photo } = req.body;
      const filter = { email: params_email };
      const updatePostAuthor = {
        $set: {
          name,
        },
      };
      if (user_photo) {
        updatePostAuthor.$set.user_photo = user_photo;
      }
      const result = commentCollection.updateMany(filter, updatePostAuthor);
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
  res.send("NH Social server is running");
});

app.listen(port, () => {
  console.log(`NH Social server is running on port ${port}`);
});
