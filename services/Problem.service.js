"use strict";

let {MoleculerClientError} = require("moleculer").Errors;
const {ForbiddenError} = require("moleculer-web").Errors;
const jsJoda = require("js-joda");
const ObjectID = require("mongodb").ObjectID;
const DbService = require("../mixins/db.mixin");
let LocalDate = require("js-joda").LocalDate;
module.exports = {
    name: "problems",
    mixins: [DbService("problems")],

    /**
     * Default settings
     */
    settings: {
        fields: ["_id", "type", "adresse", "createDate", "updateDate", "description", "place", "heureProblem", "media", "createurProblem"],
        populates: {
            createurProblem: {
                action: "users.get",
                params: {
                    fields: ["username"]
                }
            },
            media: {
                action: "medias.get",
                params: {
                    fields: ["_id"]
                }
            },

        },
        entityValidator: {
            type: {type: "string"},
            media: {type: "string", optional: true},
            place: {type: "object", optional: true}


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
         * @param {Object} person - Person entity
         *
         * @returns {Object} Created entity & token
         */
        create: {
            auth: "required",
            params: {
                problem: {type: "object"}
            },
            handler(ctx) {
                let problem = ctx.params.problem;
                return this.Promise.resolve(problem._id)
                    .then(_id => this.findById(_id))
                    .then(entity => {
                        if (!entity) {
                            return this.validateEntity(problem)
                                .then(() => {
                                    // problem.createurProblem =  ctx.meta.user._id.toString();
                                    problem.createDate = new Date();
                                    problem.updateDate = new Date();
                                    return this.adapter.insert(problem)
                                        .then(doc => this.transformDocuments(ctx, {populate: ["createurProblem"]}, doc))
                                        .then(entity => this.transformResult(ctx, entity))
                                        .then(problem => {
                                            let problemId = problem.problem._id;
                                            let newData = problem.problem;
                                            return ctx.call("medias.create", {
                                                problem: problem.problem._id.toString(), media: {}
                                            }).then((media) => {
                                                newData.media = media.media._id.toString();
                                                delete  newData._id;
                                                newData.updateDate = new Date();
                                                const update = {
                                                    "$set": newData
                                                };
                                                return this.adapter.updateById(problemId, update)
                                                    .then(doc => this.transformDocuments(ctx, {populate: ["media._id", "place.id"]}, doc))
                                                    .then(problem => this.transformResult(ctx, problem))
                                                    .then(json => this.entityChanged("updated", json, ctx).then(() => json));
                                            });
                                        })
                                        .then(json => this.entityChanged("created", json, ctx).then(() => json));
                                });
                        } else
                            return this.Promise.reject(new MoleculerClientError("Problem founded"));
                    });
            }
        },
        update: {
            params: {
                id: {type: "string"},
                problem: {type: "object"}
            },
            handler(ctx) {
                let newData = ctx.params.problem;
                newData.updateDate = new Date();
                return this.Promise.resolve(ctx.params.id)
                    .then(_id => this.findById(_id))
                    .then(problem => {
                        if (!problem)
                            return this.Promise.reject(new MoleculerClientError("problem not found", 404));
                        newData.createDate = problem.createDate;
                        delete newData._id;
                        const update = {
                            "$set": newData
                        };
                        return this.adapter.updateById(problem._id, update)
                            .then(doc => this.transformDocuments(ctx, {populate: ["media._id"]}, doc))
                            .then(problem => this.transformResult(ctx, problem))
                            .then(json => this.entityChanged("updated", json, ctx).then(() => json));
                    });
            }
        },
        list: {
            auth: "required",
            cache: {
                keys: ["#token"]
            },
            handler(ctx) {
                let params = {
                    sort: ["-updateDate"],
                    populate: ["media"],
                };
                let countParams;
                return this.Promise.resolve()
                    .then(() => this.Promise.all([
                        // Get rows
                        this.adapter.find(params),
                        // Get count of all rows
                        this.adapter.count(countParams)
                    ])).then(res => {
                        return this.transformDocuments(ctx, params, res[0])
                            .then(docs => this.transformResult(ctx, docs))
                            .then(r => {
                                r.problemCount = res[1];
                                return r;
                            });
                    });
            }
        },
        listByType: {
            params: {
                type: {type: "string"},
            },
            handler(ctx) {
                let params = {
                    sort: ["-createDate"],
                    fields: ["_id", "type", "adresse", "place", "createDate", "updateDate"],
                    query: {"type": ctx.params.type}

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
                                r.problemCount = res[1];
                                return r;
                            });
                    });
            }
        },
        listByUser: {
            params: {
                createurProblem: {type: "string"},
            },
            handler(ctx) {
                let params = {
                    sort: ["-createDate"],
                    fields: ["_id", "type", "adresse", "place", "createDate", "updateDate"],
                    query: {"createurProblem": ctx.params.createurProblem}

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
                                r.problemCount = res[1];
                                return r;
                            });
                    });
            }
        },
        listByMonth: {
            handler(ctx) {
                let month = ["JANUARY", "FEBRUARY", "MARS", "AVRIL", "MAY", "JUIN", "JUILLET", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVENMBER", "DECEMENBER"];
                let dataVand = [];
                let dataAcci = [];
                let dataInc = [];
                let params = {
                    fields: ["_id", "type", "adresse", "place", "createDate", "updateDate"],
                };
                let problemParMonth = [];
                let countParams;
                return this.Promise.resolve()
                    .then(() => {
                        countParams = Object.assign({}, params);
                    })
                    .then(() => {
                        // Get rows
                        return this.adapter.find()
                            .then(problem => {
                                month.forEach((m, index) => {
                                    let nbrAcc = 0;
                                    let nbrVand = 0;
                                    let nbrInc = 0;
                                    problem.forEach(function (prob) {
                                        if (index == ((prob.createDate.getMonth()))) {
                                            let auxCopia = prob.createDate.toISOString().toString("yyyyMMddHHmmss").replace(/T/, " ").replace(/\..+/, "").split(" ");
                                           // console.log(auxCopia[0].getDay());
                                            if (prob.type === "incident")
                                                nbrInc += 1;
                                            if (prob.type === "accident")
                                                nbrAcc += 1;
                                            if (prob.type === "vandalisme")
                                                nbrVand += 1;
                                        }
                                    });
                                    dataAcci.push(nbrAcc);
                                    dataVand.push(nbrVand);
                                    dataInc.push(nbrInc);
                                });

                                problemParMonth = [
                                    {
                                        label: "Vandalisme",
                                        data: dataVand,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "green",
                                        borderWidth: 0.5
                                    },
                                    {
                                        label: "Accident",
                                        data: dataAcci,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "red",
                                        borderWidth: 0.5
                                    },
                                    {
                                        label: "Incident",
                                        data: dataInc,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "blue",
                                        borderWidth: 0.5
                                    }];
                                return this.Promise.resolve(problemParMonth);
                            }).then(res => {
                                return res;
                            });
                    });
            }
        },

        listByJour: {
            handler(ctx) {
                let jour = ["DIMANCHE","LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
                let dataVand = [];
                let dataAcci = [];
                let dataInc = [];
                let params = {
                    fields: ["_id", "type", "adresse", "place", "createDate", "updateDate"],
                };
                let problemParJour = [];
                let countParams;
                return this.Promise.resolve()
                    .then(() => {
                        countParams = Object.assign({}, params);
                    })
                    .then(() => {
                        // Get rows

                        return this.adapter.find()
                            .then(problem => {
                                jour.forEach((m, index) => {
                                    let nbrAcc = 0;
                                    let nbrVand = 0;
                                    let nbrInc = 0;
                                    problem.forEach(function (prob) {
                                        if (index == ((prob.createDate.getDay()))) {
                                            let year = prob.createDate.toString().substring(11, 15);
                                            let month = prob.createDate.getMonth() + 1;
                                            if (month.toString().length === 1) {
                                                month = '0'+month.toString();
                                            }
                                            let day = prob.createDate.toString().substring(8, 10);
                                            let date = year + "-" + month + "-" + day;
                                            console.log (LocalDate.parse(date.toString()).dayOfWeek().name());
                                            //console.log(date.now())
                                            //console.log(prob.createDate.toString())
                                            if (prob.type === "incident")
                                                nbrInc += 1;
                                            if (prob.type === "accident")
                                                nbrAcc += 1;
                                            if (prob.type === "vandalisme")
                                                nbrVand += 1;
                                        }
                                    });
                                    dataAcci.push(nbrAcc);
                                    dataVand.push(nbrVand);
                                    dataInc.push(nbrInc);
                                });

                                problemParJour = [
                                    {
                                        label: "Vandalisme",
                                        data: dataVand,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "green",
                                        borderWidth: 0.5
                                    },
                                    {
                                        label: "Accident",
                                        data: dataAcci,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "red",
                                        borderWidth: 0.5
                                    },
                                    {
                                        label: "Incident",
                                        data: dataInc,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "blue",
                                        borderWidth: 0.5
                                    }];
                                return this.Promise.resolve(problemParJour);
                            }).then(res => {
                                return res;
                            });
                    });
            }
        },
        listByDate: {
            params: {
                datee: {type: "any"},
            },
            handler(ctx) {
                let jour = ["DIMANCHE","LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
                let dataVand = [];
                let dataAcci = [];
                let dataInc = [];
                let params = {
                    fields: ["_id", "type", "adresse", "place", "createDate", "updateDate"],
                    query: {"createDate": ctx.params.datee}
                };
                let problemParJour = [];
                let countParams;
                return this.Promise.resolve()
                    .then(() => {
                        countParams = Object.assign({}, params);
                    })
                    .then((problem) => {
                       return this.adapter.find(params)
                        .then(problem => {
                                jour.forEach((m, index) => {
                                    let nbrAcc = 0;
                                    let nbrVand = 0;
                                    let nbrInc = 0;
                                    problem.forEach(function (prob) {
                                        if (index == ((prob.createDate.getDay()))) {
                                            let year = prob.createDate.toString().substring(11, 15);
                                            let month = prob.createDate.getMonth() + 1;
                                            if (month.toString().length === 1) {
                                                month = '0'+month.toString();
                                            }
                                            let day = prob.createDate.toString().substring(8, 10);
                                            let date = year + "-" + month + "-" + day;
                                            console.log (LocalDate.parse(date.toString()).dayOfWeek().name());
                                            if (prob.type === "incident")
                                                nbrInc += 1;
                                            if (prob.type === "accident")
                                                nbrAcc += 1;
                                            if (prob.type === "vandalisme")
                                                nbrVand += 1;
                                        }
                                    });
                                    dataAcci.push(nbrAcc);
                                    dataVand.push(nbrVand);
                                    dataInc.push(nbrInc);
                                });

                                problemParJour = [
                                    {
                                        label: "Vandalisme",
                                        data: dataVand,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "green",
                                        borderWidth: 0.5
                                    },
                                    {
                                        label: "Accident",
                                        data: dataAcci,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "red",
                                        borderWidth: 0.5
                                    },
                                    {
                                        label: "Incident",
                                        data: dataInc,
                                        fill: true,
                                        lineTension: 0.2,
                                        borderColor: "blue",
                                        borderWidth: 0.5
                                    }];
                                return this.Promise.resolve(problemParJour);
                            }).then(res => {
                                return res;
                            });
                    });
            }
        },


        remove: {
            params: {
                id: {type: "string"}
            },
            handler(ctx) {
                return this.Promise.resolve(ctx.params.id)
                    .then(id => {
                        return this.adapter.removeById(id)
                            .then(problem => {
                                if (problem.media) {
                                    ctx.call("medias.remove", {id: problem.media.toString()});
                                }
                            });
                    });
            }
        }

    },
    methods: {
        /**
         * Find a problem by id
         *
         * @param {id} id - problem id
         *
         * @results {Object} Promise<problem
         */
        findById(_id) {
            console.log(ObjectID(_id));
            return this.adapter.findOne({"_id": ObjectID(_id)});
        },
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
                    .then(problems => ({problems}));
            } else {
                return this.transformEntity(ctx, entities)
                    .then(problem => ({problem}));
            }
        },

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
    },

};