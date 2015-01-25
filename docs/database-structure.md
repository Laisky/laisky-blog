Gargantua Database Structure
---

- [blog](#blog)
    - [db.posts](#posts)
    - [db.users](#users)

# blog

## posts

```js
{
    "_id": < ObjectId >,                         // created_time = _id.generation_time
    "post_title": < str >,
    "post_status": < str >,                      // "published" / "closed"
    "post_modified_gmt": < datetime.datetime >,
    "post_password": < str >,
    "post_author": < ObjectId >,                 // db.users._id
    "post_name": < str >,
    "comment_status": < str >,                   // "open" / "closed"
    "post_content": < str >
}
```

## users

```js
{
    "_id": < ObjectId >,        // created_time = _id.generation_time
    "account": < str >,
    "password": < bytes >,      // encrypt by py-bcrypt
    "username": < str >,
    "email": < str >
}
```
