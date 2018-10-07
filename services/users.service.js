"use strict";

const {MoleculerClientError} = require("moleculer").Errors;
const ObjectID = require("mongodb").ObjectID;

//const crypto 		= require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const DbService = require("../mixins/db.mixin");

module.exports = {
    name: "users",
    mixins: [DbService("users")],

    /**
     * Default settings
     */
    settings: {
        /** Secret for JWT */
        JWT_SECRET: process.env.JWT_SECRET || "jwt-transtu-secret",

        /** Public fields */
        fields: ["_id", "username", "password", "dateNaissance", "email", "role"],

        /** Validator schema for entity */
        entityValidator: {
            username: {type: "string", min: 2},
            password: {type: "string", min: 6},
            email: {type: "email"},
            role: {type: "string",}
        }
    },

    /**
     * Actions
     */
    actions: {
        /**
         * Register a new user
         *
         * @actions
         * @param {Object} user - User entity
         *
         * @returns {Object} Created entity & token
         */
        create: {
            params: {
                user: {type: "object"}
            },
            handler(ctx) {
                let entity = ctx.params.user;
                return this.validateEntity(entity)
                    .then(() => {
                        if (entity.email)
                            return this.adapter.findOne({email: entity.email})
                                .then(found => {
                                    if (found)
                                        return Promise.reject(new MoleculerClientError("Email is exist!", 422, "", [{
                                            field: "email",
                                            message: "is exist"
                                        }]));
                                });

                    })
                    .then(() => {
                        entity.password = bcrypt.hashSync(entity.password, 10);
                        entity.role = entity.role || "";
                        entity.dateNaissance = entity.dateNaissance || null;
                        entity.createDate = new Date();
                        return this.adapter.insert(entity)
                            .then(doc => this.transformDocuments(ctx, {}, doc))
                            .then(user => this.transformEntity(user, true, ctx.meta.token))
                            .then(json => this.entityChanged("created", json, ctx).then(() => json));
                    });
            }
        },
        /**
         * Login with email & password
         *
         * @actions
         * @param {Object} user - User credentials
         *
         * @returns {Object} Logged in user with token
         */
        login: {
            params: {
                user: {
                    type: "object", props: {
                        email: {type: "email"},
                        password: {type: "string", min: 1}
                    }
                }
            },
            handler(ctx) {
                const {email, password} = ctx.params.user;
                let entity = ctx.params.user;
                console.log(entity)
                return this.Promise.resolve()
                    .then(() => this.adapter.findOne({email: entity.email}))
                    .then(user => {
                        console.log(user)
                        if (!user)
                            return this.Promise.reject(new MoleculerClientError("Email or password is invalid!", 422, "", [{
                                field: "email",
                                message: "is not found"
                            }]));

                        return bcrypt.compare(password, user.password).then(res => {
                            if (!res)
                                return Promise.reject(new MoleculerClientError("Wrong password!", 422, "", [{
                                    field: "email",
                                    message: "is not found"
                                }]));

                            // Transform user entity (remove password and all protected fields)
                            return this.transformDocuments(ctx, {}, user);
                        });
                    })
                    .then(user => this.transformEntity(user, true, ctx.meta.token));
            }
        },
        /**
         * Get user by JWT token (for API GW authentication)
         *
         * @actions
         * @param {String} token - JWT token
         *
         * @returns {Object} Resolved user
         */
        resolveToken: {
            cache: {
                keys: ["token"],
                ttl: 60 * 60 // 1 hour
            },
            params: {
                token: "string"
            },
            handler(ctx) {
                return new this.Promise((resolve, reject) => {
                    jwt.verify(ctx.params.token, this.settings.JWT_SECRET, (err, decoded) => {
                        if (err)
                            return reject(err);

                        resolve(decoded);
                    });

                })
                    .then(decoded => {
                        if (decoded.id)
                            return this.getById(decoded.id);
                    });
            }
        },
        /**
         * Get current user entity.
         * Auth is required!
         *
         * @actions
         *
         * @returns {Object} User entity
         */
        me: {
            auth: "required",
            cache: {
                keys: ["#userID"]
            },
            handler(ctx) {
                return this.getById(ctx.meta.user._id)
                    .then(user => {
                        if (!user)
                            return this.Promise.reject(new MoleculerClientError("User not found!", 400));

                        return this.transformDocuments(ctx, {}, user);
                    })
                    .then(user => this.transformEntity(user, true, ctx.meta.token));
            }
        },
        /**
         * Update current user entity.
         * Auth is required!
         *
         * @actions
         *
         * @param {Object} user - Modified fields
         * @returns {Object} User entity
         */
        updateMyself: {
            auth: "required",
            params: {
                user: {
                    type: "object", props: {
                        username: {type: "string", min: 2, optional: true, pattern: /^[a-zA-Z0-9]+$/},
                        password: {type: "string", min: 6, optional: true},
                        email: {type: "email", optional: true},
                        role: {type: "string", optional: true}

                    }
                }
            },
            handler(ctx) {
                const newData = ctx.params.user;
                return this.Promise.resolve()
                    .then(() => {
                        if (newData.username)
                            return this.adapter.findOne({username: newData.username})
                                .then(found => {
                                    if (found && found._id.toString() !== ctx.meta.user._id.toString())
                                        return Promise.reject(new MoleculerClientError("Username is exist!", 422, "", [{
                                            field: "username",
                                            message: "is exist"
                                        }]));

                                });
                    })
                    .then(() => {
                        if (newData.email)
                            return this.adapter.findOne({email: newData.email})
                                .then(found => {
                                    if (found && found._id.toString() !== ctx.meta.user._id.toString())
                                        return Promise.reject(new MoleculerClientError("Email is exist!", 422, "", [{
                                            field: "email",
                                            message: "is exist"
                                        }]));
                                });

                    })
                    .then(() => {
                        newData.updateDate = new Date();
                        const update = {
                            "$set": newData
                        };
                        return this.adapter.updateById(ctx.meta.user._id, update);
                    })
                    .then(doc => this.transformDocuments(ctx, {}, doc))
                    .then(user => this.transformEntity(user, true, ctx.meta.token))
                    .then(json => this.entityChanged("updated", json, ctx).then(() => json));

            }
        },
        /**
         * Get a user profile.
         *
         * @actions
         *
         * @param {String} username - Username
         * @returns {Object} User entity
         */
        profile: {
            cache: {
                keys: ["#userID", "username"]
            },
            params: {
                username: {type: "string"}
            },
            handler(ctx) {
                return this.adapter.findOne({username: ctx.params.username})
                    .then(user => {
                        if (!user)
                            return this.Promise.reject(new MoleculerClientError("User not found!", 404));

                        return this.transformDocuments(ctx, {}, user);
                    })
                    .then(user => this.transformProfile(ctx, user, ctx.meta.user));
            }
        },

        list: {
            handler(ctx) {
                let params = {
                    sort: ["-updateDate"],
                };
                let countParams;
                return this.Promise.resolve()
                    .then(() => {
                        // Get rows
                        return this.adapter.find(params);
                        // Get count of all rows

                    }).then(res => {

                        return this.transformDocuments(ctx, params, res)
                            .then(r => {

                                return r;
                            }).then(user => this.transformEntity(user, true));
                    });
            }
        }
    },

    /**
     * Methods
     */
    methods: {
        findById(_id) {
            console.log(ObjectID(_id));
            return this.adapter.findOne({"_id": ObjectID(_id)});
        }, /**
         * Generate a JWT token from user entity
         *
         * @param {Object} user
         */
        generateJWT(user) {
            const today = new Date();
            const exp = new Date(today);
            exp.setDate(today.getDate() + 60);

            return jwt.sign({
                id: user._id,
                username: user.username,
                exp: Math.floor(exp.getTime() / 1000)
            }, this.settings.JWT_SECRET);
        },


        /**
         * Transform returned user entity. Generate JWT token if neccessary.
         *
         * @param {Object} user
         * @param {Boolean} withToken
         */
        transformEntity(user, withToken, token) {
            if (user) {
                if (withToken)
                    user.token = token || this.generateJWT(user);
            }
            return {user};
        },
    },

    events: {
        "cache.clean.users"() {
            if (this.broker.cacher)
                this.broker.cacher.clean(`${this.name}.*`);
        },
        "cache.clean.follows"() {
            if (this.broker.cacher)
                this.broker.cacher.clean(`${this.name}.*`);
        }
    }
};