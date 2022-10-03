import passportLocal from "passport-local"
const LocalStrategy = passportLocal.Strategy
import bcrypt from "bcrypt"
import { ROLES } from "./utils/roles.js"
import flash from "express-flash"

function initialize(passport, getUser, getUserById) {
    const authenticateUser = async (username, password, done) => {
        await getUser(username).then((async user => {
            // console.log(user)
            if (user == null) {
                console.log("user is null")
                return done(null, false, { message: "No user with that username" });
            }

            try {
                if (await bcrypt.compare(password, user.password)) {
                    console.log("Password matched")
                    if (user.type === ROLES['unverified']) {
                        console.log("User not verified")
                        return done(null, false, {message: "User not verified"});
                    }
                    return done(null, user)
                } else {
                    console.log("Password no match")
                    return done(null, false, { message: "Incorrect password" })
                }
            } catch (e) {
                console.log(e)
                return done(e)
            }
        }))
    }

    passport.use(new LocalStrategy(authenticateUser))

    passport.serializeUser((user, done) => done(null, user.username))

    passport.deserializeUser((username, done) => {
        getUser(username).then(user => {
            //  console.log(user)
            return done(null, user)
        }

        )
        // return done(null, getUserById(id))
    })
}

export { initialize }