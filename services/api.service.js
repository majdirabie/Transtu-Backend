"use strict";

const _ = require("lodash");
const ApiGateway = require("moleculer-web");
const {UnAuthorizedError} = ApiGateway.Errors;

module.exports = {
    name: "api",
    mixins: [ApiGateway],

    settings: {
        port: process.env.PORT || 3000,

        routes: [{
            path: "/api",

            authorization: true,
            //cores: true,

            aliases: {
                // Login
                "POST /users/login": "users.login",
                // Users
                "REST /users": "users",
                "GET /user/all":"users.listUser",
                // Current user
                "GET /user": "users.me",
                "PUT /user": "users.updateMyself",
                //Profile
                "GET /profiles/:username": "users.profile",

                // problem
                "REST /problems": "problems",
                "POST /problems/:type": "problems.listByType",
                "POST /problems/users/:createurProblem": "problems.listByUser",
                "POST /problems/prob/stats": "problems.listByMonth",
                "POST /problems/prob/statsParJour": "problems.listByJour",
                "POST /problems/prob/statsParDate/:datee": "problems.listByDate",

                // media
                "PUT /medias/:_id/remove": "medias.removeMedia",
                "PUT /medias/:_id/add": "medias.addMedia",
                "REST /medias": "medias",
                "GET /problems/:_id/medias": "medias.listByProblem",
                "GET /medias/Images/:id ": "medias.Images",



            },

            // Set CORS headers
            cors: true,

            // Parse body content
            bodyParsers: {
                json: {
                    strict: false
                },
                urlencoded: {
                    extended: false
                }
            }
        }],

        assets: {
            folder: "./public"
        }
    },

    methods: {
        /**
         * Authorize the request
         *
         * @param {Context} ctx
         * @param {Object} route
         * @param {IncomingRequest} req
         * @returns {Promise}
         */
        authorize(ctx, route, req) {
            let token;
            if (req.headers.authorization) {
                let type = req.headers.authorization.split(" ")[0];
                if (type === "Token" || type === "Bearer")
                    token = req.headers.authorization.split(" ")[1];
            }

            return this.Promise.resolve(token)
                .then(token => {
                    if (token) {
                        // Verify JWT token
                        return ctx.call("users.resolveToken", {token})
                            .then(user => {
                                if (user) {
                                    this.logger.info("Authenticated via JWT: ", user.email);
                                    // Reduce user fields (it will be transferred to other nodes)
                                    ctx.meta.user = _.pick(user, ["_id", "username", "email", "role","password","dateNaissance"]);
                                    ctx.meta.token = token;
                                }
                                return user;
                            })
                            .catch(err => {
                                // Ignored because we continue processing if user is not exist
                                return null;
                            });
                    }
                })
                .then(user => {
                    if (req.$endpoint.action.auth == "required" && !user)
                        return this.Promise.reject(new UnAuthorizedError());
                });
        },

        /**
         * Convert ValidationError to RealWorld.io result
         * @param {*} req
         * @param {*} res
         * @param {*} err
         */
        /*sendError(req, res, err) {
            if (err.code == 422) {
                res.setHeader("Content-type", "application/json; charset=utf-8");
                res.writeHead(422);
                let o = {};
                err.data.forEach(e => {
                    let field = e.field.split(".").pop();
                    o[field] = e.message;
                });
                return res.end(JSON.stringify({
                    errors: o
                }, null, 2));

            }

            return this._sendError(req, res, err);
        }*/
    },

    created() {
        // Pointer to the original function
        //this._sendError = ApiGateway.methods.sendError.bind(this);
    }


};
