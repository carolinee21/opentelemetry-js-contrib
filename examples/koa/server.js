'use strict';

// eslint-disable-next-line
const tracer = require('./tracer')('example-koa-server');


// Adding Koa router (if desired)
const router = require('@koa/router')();
const koa = require('koa');

// Setup koa
const app = new koa();
const PORT = 8081;

// route definitions
router.get('/run_test', runTest)
    .get('/post/new', addPost)
    .get('/post/:id', showNewPost);
    

async function setUp () {
    app.use(no_op);
    app.use(router.routes());
}

/**
 *  Router functions: list, add, or show posts
*/
const posts = ["post 0", "post 1", "post 2"];

async function addPost(ctx) {
    posts.push("post " + posts.length);
    console.log("addPost");
    const currentSpan = tracer.getCurrentSpan();
    currentSpan.addEvent("Added post");
    currentSpan.setAttribute("Date", new Date);
    ctx.body = "Added post: " + posts[posts.length-1];
    const viewNewPost = ctx.redirect(`/post/3`);
}

async function showNewPost(ctx) {
    console.log("showPost");
    const id = ctx.params.id;
    const post = posts[id];
    if (!post) ctx.throw(404, 'Invalid post id');
    ctx.body = post;
}

async function runTest (ctx, next) {
    console.log("runTest");
    ctx.body = "All posts: " + posts;
    const addNewPost = ctx.redirect(`/post/new`);
}

function no_op (ctx, next) {
    console.log("Sample basic koa middleware");
    next();
}

setUp().then(() => {
    app.listen(PORT);
    console.log(`Listening on http://localhost:${PORT}`);
});
