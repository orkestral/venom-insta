

# 🕷Venom Insta🕸

![enter image description here](https://s2.click/venom.jpg)

> Venom is a high-performance system developed in JavaScript to create a bot for Instagram, support for creating posts, comments, liked posts, follow, unfollow and all types of design architecture for Instagram.


## 🕷🕷 Functions Venom🕷🕷
|  |  |
|--|--|
| Automatic Login | ✔ |
| Get **Post, Commets, Media, Likes and Profile** | ✔ |
| Search for **keywords and Hashtag**  | ✔ |
| Register Automatic  |  |
| 🕸🕸 **and much more**| ✔ |

## Installation

```bash
> npm i --save venom-insta
```
## Getting started

```javascript

const venom = require('venom-insta');

(async () => {

const insta = await venom.launchBot({ headless: true });

// login
await insta.login("[your-username]", "[your-password]");

.....

})();
```

##### After executing `launchBot()` function, **venom** will create an instance of Instagram web. 

<br>

## Optional create parameters

Venom `launchBot()` method third parameter can have the following optional parameters:
```javascript
insta.launchBot({
  headless: true, // Headless chrome
});
```

## Maintainers

Maintainers are needed, I cannot keep with all the updates by myself. If you are
interested please open a Pull Request.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to
discuss what you would like to change.
