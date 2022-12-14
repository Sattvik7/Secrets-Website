require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate')

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

app.use(session({                  /////////See config docs of passportjs google.
  secret: "Our Little Secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());             /////////See config docs of passportjs google.
app.use(passport.session());             /////////See config docs of passportjs google.

mongoose.connect('mongodb://localhost:27017/userDB', {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose); ////For encryption for username and password.
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {           //////It makes a cookie and stores the user data in it.
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {             //////It crumbles the cookie and uses data stored in it.
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

/////////////////////////////////////////////HOME ROUTE//////////////////////////////////////////
app.route("/")
.get(function(req, res){
  res.render("home")
});

//////////////////////////////////////////////LOGIN ROUTE//////////////////////////////////////////
app.route("/login")
.get(function(req, res){
  res.render("login")
})

.post(function(req, res){
  const user = new User({  ///// Instead of finding user(User.findOne()) from existing DB it creates a new one(Doesn't store in DB) and checks it with DB.
    username: req.body.username,
    password: req.body.password
  })
  req.login(user, function(err) {
  if (err){
    console.log(err);
  }else{
  passport.authenticate("local")(req, res, function(){
    res.redirect("/secrets");
  });
}
});
});

/////////////////////////////////////////GOOGLE SIGNUP ROUTE///////////////////////////////////////
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

  app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

//////////////////////////////////////////FACEBOOK SIGNUP///////////////////////////////////////////
app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

////////////////////////////////////////////LOGOUT ROUTE//////////////////////////////////////////////
app.route("/logout")
.get(function(req, res){
  req.logout();
  res.redirect('/');
});

////////////////////////////////////////////SECRETS ROUTE////////////////////////////////////////////
app.route("/secrets")
.get(function(req, res){
  if(req.isAuthenticated()){
    User.find({"secret": {$ne: null}}, function(err, foundUsers){
      if(err){
        console.log(err);
      }else{
        if(foundUsers){
          res.render("secrets", {userWithSecrets: foundUsers});
        }
      }
    });
  }else{
    res.redirect("/login");
  }
});

////////////////////////////////////////////REGISTER ROUTE//////////////////////////////////////////
app.route("/register")
.get(function(req, res){
  res.render("register")
})

.post(function(req, res){
  User.register({username: req.body.username}, req.body.password, function(err, user){  ///Registers the new user.
    if(err){
      console.log(err);
      res.redirect("/register")
    }else{
      passport.authenticate("local")(req, res, function(){ /// passport.authenticate automatically logins new user after registration.
        res.redirect("/secrets")
      })
    }
  });
});

////////////////////////////////////////////////////////SECRETS ROUTE//////////////////////////////////////////////////////
app.route("/submit")
.get(function(req, res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login")
  }
})

.post(function(req, res){
  const submittedSecret = req.body.secret;

  User.findById(req.user._id, function(err, foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser){
        foundUser.secret = submittedSecret;
        foundUser.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });
});





app.listen(3000, function() {
  console.log("Server started on port 3000");
});
