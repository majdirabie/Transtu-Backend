"use strict";

let {MoleculerClientError} = require("moleculer").Errors;
const {ForbiddenError} = require("moleculer-web").Errors;
const ObjectID = require("mongodb").ObjectID;
const DbService = require("../mixins/db.mixin");

const multer = require("multer");
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
});
//const upload = multer({storage: storage});
const upload = multer({dest: "./uploads/"});

module.exports = {
    name: "medias",
    mixins: [DbService("medias")],

    /**
     * Default settings
     */
    settings: {
        fields: ["_id", "problem", "path_img", "path_pdf", "createDate", "updateDate"],
        populates: {
            problem_id: {
                action: "problems.get",
                params: {
                    fields: ["_id", "type"]
                }
            }
        },
        entityValidator: {
            path_img: {type: "array", items: "string", optional: true},
            path_pdf: {type: "array", items: "string", optional: true},
        }


    },
    /**
     * Actions
     */
    actions: {
        /**
         * cree a new media
         *
         * @actions
         * @param {Object} person - Media entity
         *
         * @returns {Object} Created entity
         */
        create: {
            params: {
                media: {type: "object"},
                problem: {type: "string"},
            },
            handler(ctx, req) {
                let media = ctx.params.media;
                media.problem = ctx.params.problem;
                return this.validateEntity(media)
                    .then(() => {
                        if (media._id)
                            return this.adapter.findOne({_id: media._id})
                                .then(found => {
                                    if (found)
                                        return Promise.reject(new MoleculerClientError("Email is exist!"));
                                });
                    })
                    .then(() => {
                        media.path_img = [];
                        media.path_pdf = [];
                        media.createDate = new Date();
                        media.updateDate = new Date();
                        return this.adapter.insert(media)
                            .then(doc => this.transformDocuments(ctx, {populate: ["problem"]}, doc))
                            .then(media => this.transformResult(ctx, media))
                            .then(json => this.entityChanged("created", json, ctx).then(() => json));
                    });
            }
        },


        update: {
            params: {
                id: {type: "string"},
                media: {
                    type: "object", props: {
                        updateDate: {type: "date", optional: true},

                    },
                }
            },
            handler(ctx) {
                let newData = ctx.params.media;
                newData.updateDate = new Date();
                return this.Promise.resolve(ctx.params.id)
                    .then(_id => this.findById(_id))
                    .then(media => {
                        if (!media)
                            return this.Promise.reject(new MoleculerClientError("media not found", 404));
                        const update = {
                            "$push": {"path_img": "hela", "path_pdf": "sami"},
                        };
                        return this.adapter.updateById(media._id, update)
                            .then(doc => this.transformDocuments(ctx, {populate: ["problem"]}, doc))
                            .then(media => this.transformResult(ctx, media))
                            .then(json => this.entityChanged("updated", json, ctx).then(() => json));
                    });


            }
        },
        list: {
            handler(ctx) {
                let params = {
                    sort: ["-updateDate"],
                    populate: ["problem"],
                };
                let countParams;

                return this.Promise.resolve()
                    .then(() => {
                        countParams = Object.assign({}, params);
                    })
                    .then(() => this.Promise.all([
                        // Get rows
                        this.adapter.find(params),
                        // Get count of all rows
                        this.adapter.count(countParams)
                    ])).then(res => {
                        return this.transformDocuments(ctx, params, res[0])
                            .then(docs => this.transformResult(ctx, docs))
                            .then(r => {
                                r.mediaCount = res[1];
                                return r;
                            });
                    });
            }
        },
        /**
         * List of media by problem.
         *
         * @actions
         * @param {String} problem_id - Problem ID
         * @param {Number} limit - Pagination limit
         * @param {Number} offset - Pagination offset
         *
         * @returns {Object} List of media
         */
        listByProblem: {
            params: {
                _id: {type: "string"},
            },
            handler(ctx) {
                let params = {
                    sort: ["-createDate"],
                    fields: ["_id", "createDate", "updateDate"],
                    query: {"problem": ctx.params._id},
                };
                let countParams;

                return this.Promise.resolve()
                    .then(() => {
                        countParams = Object.assign({}, params);
                    })
                    .then(() => this.Promise.all([
                        // Get rows
                        this.adapter.find(params),
                        // Get count of all rows
                        this.adapter.count(countParams)
                    ])).then(res => {
                        return this.transformDocuments(ctx, params, res[0])
                            .then(docs => this.transformResult(ctx, docs))
                            .then(r => {
                                r.mediasCount = res[1];
                                return r;
                            });
                    });
            }
        },


        remove: {

            params: {
                id: {type: "any"}
            },
            handler(ctx) {
                return this.getById(ctx.params.id)
                    .then(media => {
                        return this.adapter.removeById(ctx.params.id)
                            .then(json => this.entityChanged("removed", json, ctx).then(() => json));
                    });
            }
        },

        removeMedia: {
            params: {
                _id: {type: "string"},
                media: {
                    type: "object"
                },
            },

            handler(ctx) {
                let media = ctx.params.media;
                return this.Promise.resolve(ctx.params._id)
                    .then(id => this.findById(id))
                    .then(media => {
                        if (!media)
                            return this.Promise.reject(new MoleculerClientError("media not found", 404));
                        const update = {
                            "$pull": {"path_img": "telechargement.jpg"},
                        };
                        return this.adapter.updateById(media._id, update)
                            .then(doc => this.transformDocuments(ctx, {populate: ["problem"]}, doc))
                            .then(media => this.transformResult(ctx, media))
                            .then(json => this.entityChanged("updated", json, ctx).then(() => json));

                    });


            }

        },
        addMedia:
            {
                params:
                    {
                        _id: {
                            type: "string"
                        }
                        ,
                        //media : {type:"object"}
                    }
                ,
                handler(ctx) {
                    return this.Promise.resolve(ctx.params._id)
                        .then(id => this.findById(id))
                        .then(media => {
                            if (!media)
                                return this.Promise.reject(new MoleculerClientError("media not found", 404));
                            const update = {
                                "$push": {"path_img": "telechargement.jpg"},
                            };
                            return this.adapter.updateById(media._id, update)
                                .then(doc => this.transformDocuments(ctx, {populate: ["problem"]}, doc))
                                .then(media => this.transformResult(ctx, media))
                                .then(json => this.entityChanged("updated", json, ctx).then(() => json));
                        }).then(media => {
                            if (media.media.problem) {
                                    return ctx.call("problems.get", {"id": media.media.problem})
                                        .then(problem => {
                                            if (media) {
                                                return this.Promise.resolve(media)
                                                    .then(media => {
                                                        ctx.call('problems.update', {"id": media.media.problem, problem: {}});
                                                        return this.Promise.resolve(problem);
                                                    });
                                            }
                                        });
                                }
                            }
                        );


                }

            },
        /**
         * Get list of available tags
         *
         * @returns {Object} Tag list
         */
        Images: {
            cache: {
                keys: []
            }
            ,
            params: {
                id: {
                    type: "string"
                }
            }
            ,
            handler(ctx) {
                console.log(ctx.params.id);
                return this.Promise.resolve(ctx.params.id)
                    .then(id => this.findById(id))
                    .then(media => {
                        if (!media)
                            return this.Promise.reject(new MoleculerClientError("media not found", 404));
                        media.path_img.forEach(function (element) {
                            console.log(element);
                        });
                    }).then(() => this.adapter.find({fields: ["path_img"]}))
                    .then(list => {
                        return list.path_img.map(o => o.path_img);
                    })
                    .then(images => ({images}));
            }
        }
        ,
    },
    methods:
        {
            /**
             * Find a media by id
             *
             * @param {id} id - media id
             *
             * @results {Object} Promise<media
             */
            findById(_id) {
                return this.adapter.findOne({"_id": ObjectID(_id)});
            }
            ,
            /**
             * Transform the result entities to follow the RealWorld API spec
             *
             * @param {Context} ctx
             * @param {Array} entities
             * @param {Object} user - Logged in user
             */
            transformResult: function (ctx, entities) {
                if (Array.isArray(entities)) {
                    return this.Promise.map(entities, item => this.transformEntity(ctx, item))
                        .then(medias => ({medias}));
                } else {
                    return this.transformEntity(ctx, entities)
                        .then(media => ({media}));
                }
            }
            ,

            /**
             * Transform a result entity to follow the RealWorld API spec
             *
             * @param {Context} ctx
             * @param {Object} entity
             */
            transformEntity(ctx, entity) {
                if (!entity) return this.Promise.resolve();

                return this.Promise.resolve(entity);
            }
        }
    ,
}
;