/* imports */
const puppeteer = require("puppeteer");
const tools = require("./tools.js");
const util = require("./util.js");
const { errorMessage } = require("./message.js"); 


/* functions */
const launchBrowser = async (args) => await puppeteer.launch(args);
const newPage = async (browser, url, language) => {
  // create page
  const page = await browser.newPage();
  // change language
  await page.setExtraHTTPHeaders({
    'Accept-Language': language ? language : 'en'
  });
  // set url
  await page.goto(url);
  return page;
}
const managePopups = async (page) => {
  // clicks on every button that says 'Not Now'
  // intended for 'Turn on Notifications' popup
  await tools.clickOn(page, "button", { innerText: "Not Now"})
}
const pageExists = async (page) => {
  // check if the text "Sorry, this page isn't available." is present on the current page
  const exists = await page.evaluate(() => [...document.querySelectorAll("h2")].reduce((prev, element) => {
    if(element.innerHTML == "Sorry, this page isn't available.") return false;
    return prev;
  }, true));
  return exists;
}
const screenshot = async (page, path) => {

  await page.screenshot({ path });

}
// login
const login = async (page, username, password) => {

    // goto login page
    await page.goto("https://www.instagram.com/");
    await util.wait(1000 * 5);

    // enter username
    await page.waitForSelector("[name='username']");
    await page.type("[name='username']", username);

    // enter password
    await page.keyboard.down('Tab');
    await page.keyboard.type(password);

    // click login button
    await tools.clickOnButton(page, "Log In");
    await util.wait(1000 * 5);

    // check if error happened
    const wrongPassword = await page.evaluate(() => [...document.querySelectorAll("p")].reduce((prev, element) => {
      if(element.innerHTML == "Sorry, your password was incorrect. Please double-check your password.") return true;
      return prev;
    }, false));

    if(wrongPassword) return errorMessage.wrongPassword;

    return { error: false }

}
const logout = async (page, username) => {

    // goto instagram page
    await page.goto("https://www.instagram.com/");
    await util.wait(1000 * 5);

    await managePopups(page);

    // find profile image and click it
    await tools.clickOn(page, "[alt]", { alt: username + "'s profile picture" });

    // click on 'Log Out' Button
    await tools.clickOnDiv(page, "Log Out");

    return { error: false }

}
// search
const search = async (page, term, state = {}) => {

    await util.wait(1000 * 4);
    await managePopups(page);
    await util.wait(1000 * 1);

    // wait for search term field to appear
    await page.waitForSelector("[placeholder='Search']");
    // clear search term field
    await page.evaluate(() => {
      const element = document.querySelector("[placeholder='Search']");
      element.value = '';
    })
    // enter search term
    await page.type("[placeholder='Search']", term);

    await util.wait(1000 * 4);

    // load results into array
    const searchResults = await page.evaluate(() => {
        const elements = [...document.querySelectorAll(".yCE8d")];
        const tile = elements.map((element) => {
          const link = element.href;
          const username = element.querySelector(".Ap253").innerHTML;
          const name = element.querySelector(".Fy4o8").innerHTML;
          return { link, name, username }
        })
        return tile;
    })

    // add 'click' and 'getProfile' function to searchResults Array
    const result = searchResults.map((searchResult) => {
        return {
          link: searchResult.link,
          name: searchResult.name,
          username: searchResult.username,
          click: () => tools.clickOn(page, "a", { href: searchResult.link }),
          getProfile: (state) => getProfile(page, searchResult.username, state)
        }
    })

    // update state
    const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

    return { error: false, results: result, state: newState };

}
const exploreHashtag = async (page, hashtag, minPosts = 20, state = {}) => {

  // search for hashtag
  const { results } = await search(page, hashtag);

  // click on search result for the specific hashtag
  results.forEach((searchResult) => { if(searchResult.username == hashtag) { searchResult.click(); }})
  await util.wait(1000 * 5);  

  // fetch top posts
  const loadedPosts = await page.evaluate(() => {
    const elements = [...document.querySelectorAll("a")];
    const posts = elements.filter((element) => element.href.startsWith("https://www.instagram.com/p/"));
    return posts.map((post) => {
      return {
        "link": post.href
      }
    })
  });
  const topPosts = loadedPosts.filter((post, index) => index < 9);

  // load posts
  const scroll = async (oldPosts, minPosts) => {
    await tools.scrollBy(page, 1000);
    await util.wait(1000 * 1);
    const loadedPosts = await page.evaluate(() => {
      const elements = [...document.querySelectorAll("a")];
      const posts = elements.filter((element) => element.href.startsWith("https://www.instagram.com/p/"));
      return posts.map((post) => {
        return {
          "link": post.href
        }
      })
    });
    const posts = oldPosts.concat(loadedPosts);
    // remove duplicates
    const filteredPosts = posts.filter((post) => {
      const samePosts = posts.filter((value) => value.link == post.link);
      if(samePosts.length > 1) return false;
      return true;
    });
    if(filteredPosts.length > minPosts) return filteredPosts;
    const result = await scroll(filteredPosts, minPosts);
    return result;
  }
  const posts = await scroll(topPosts, (minPosts + topPosts.length));
  const filteredPosts = posts.filter((post) => {
    const samePosts = posts.filter((value) => value.link == post.link);
    if(samePosts.length > 1) return false;
    return true;
  });

  // add getPost func to result
  const formattedTopPosts = topPosts.map((post) => Object.assign(post, { getPost: (state) => getPost(page, post.link, state) }))
  const formattedPosts = filteredPosts.map((post) => Object.assign(post, { getPost: (state) => getPost(page, post.link, state) }))

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return {
    error: false,
    topPosts: formattedTopPosts,
    posts: formattedPosts,
    state: newState
  }

}
// profile
const getFollowing = async (page, username, minLength = 400, state = {}) => {
  
    // check if bot is already on the page of the user
    const alreadyOnUsersPage = page.url() == "https://www.instagram.com/" + username + "/";

    if(!alreadyOnUsersPage) {

      // search for username
      const { results } = await search(page, username);

      // click on search result for the specific username
      results.forEach((searchResult) => { if(searchResult.username == username) { searchResult.click(); }})
      await util.wait(1000 * 5);

    }

    // click on 'Following' section
    await tools.clickOn(page, `[href='/${username}/following/']`, {});

    await util.wait(1000 * 3);

    const loadFollowing = async (minLength, oldList = [], oldScrollTop) => {

      // wait
      await util.wait(1000 * 2);

      // scroll down
      await tools.scrollBy(page, 500, ".isgrP");

      // get loaded comments
      const loadedFollowingList = await page.evaluate(() => [...document.querySelector(".PZuss").children].map((element) => [...element.querySelectorAll("a")].filter((el) => el.innerText)[0]).map((el) => el.innerText));

      // concat old comments with newly loaded comments
      const followingList = loadedFollowingList.concat(oldList);

      // filter out duplicate comments
      const filteredFollowingList = followingList.reduce((prev, user) => {
        if(prev.includes(user)) return prev;
        return prev.concat([user]);
      }, []);

      // check if end of following list has been reached
      const scrollTop = await page.evaluate(() => document.querySelector(".isgrP").scrollTop);
      if(scrollTop == oldScrollTop) return filteredFollowingList;

      // check if enough following users have been loaded
      if(minLength <= filteredFollowingList.length) return filteredFollowingList;

      // recursively rerun function until enough following users have been loaded
      const result = await loadFollowing(minLength, filteredFollowingList, scrollTop);
      return result;

    }
    const following = await loadFollowing(minLength);

    // format array
    const formattedFollowing = following.map((element) => {
        return { 
          username: element,
          getProfile: (state) => getProfile(page, element, state)
        }
    })

    // update state
    const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

    return { error: false, following: formattedFollowing, state: newState };

}
const getFollower = async (page, username, minLength = 400, state = {}) => {

  // check if bot is already on the page of the user
  const alreadyOnUsersPage = page.url() == "https://www.instagram.com/" + username + "/";

  // check if bot is already on the page of the user
  if(!alreadyOnUsersPage) {

    // search for username
    const { results } = await search(page, username);

    // click on search result for the specific username
    results.forEach((searchResult) => { if(searchResult.username == username) { searchResult.click(); }})
    await util.wait(1000 * 5);  

  }

  // click on 'Followers' section
  await tools.clickOn(page, `[href='/${username}/followers/']`, {});

  await util.wait(1000 * 3);

  const loadFollower = async (minLength, oldList = [], oldScrollTop) => {

    // wait
    await util.wait(1000 * 2);

    // scroll down
    await tools.scrollBy(page, 500, ".isgrP");

    // get loaded comments
    const loadedFollowerList = await page.evaluate(() => [...document.querySelector(".PZuss").children].map((element) => [...element.querySelectorAll("a")].filter((el) => el.innerText)[0]).map((el) => el.innerText));

    // concat old comments with newly loaded comments
    const followerList = loadedFollowerList.concat(oldList);

    // filter out duplicate comments
    const filteredFollowerList = followerList.reduce((prev, user) => {
      if(prev.includes(user)) return prev;
      return prev.concat([user]);
    }, []);

    // check if end of following list has been reached
    const scrollTop = await page.evaluate(() => document.querySelector(".isgrP").scrollTop);
    if(scrollTop == oldScrollTop) return filteredFollowerList;

    // check if enough following users have been loaded
    if(minLength <= filteredFollowerList.length) return filteredFollowerList;

    // recursively rerun function until enough following users have been loaded
    const result = await loadFollower(minLength, filteredFollowerList, scrollTop);
    return result;

  }
  const follower = await loadFollower(minLength);

  // format array
  const formattedFollower = follower.map((element) => {
    return {
      username: element,
      getProfile: (state) => getProfile(page, element, state)
    }
  })

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, follower: formattedFollower, state: newState };

}
const getPosts = async (page, username, minLength = 50, state = {}) => {

  // check if bot is already on the page of the user
  if(page.url() != "https://www.instagram.com/" + username + "/") {

    // search for username
    const { results } = await search(page, username);

    // click on search result for the specific username
    results.forEach((searchResult) => { if(searchResult.username == username) { searchResult.click(); }})
    await util.wait(1000 * 5);  

  }

  // get number of posts the user uploaded
  const postsCount = await page.evaluate(() => {
    const element = document.querySelectorAll(".g47SY")[0];
    const number = parseInt(element.innerText.split(".").join(""))
    return number;
  })
  const possibleMinLength = postsCount > minLength ? minLength : postsCount;

  // load posts
  const scroll = async (oldPosts, minLength) => {
    await tools.scrollBy(page, 300);
    await util.wait(1000 * 1);
    const loadedPosts = await page.evaluate(() => {
      const elements = [...document.querySelectorAll("a")];
      const posts = elements.filter((element) => element.href.startsWith("https://www.instagram.com/p/"));
      return posts.map((post) => {
        return {
          "link": post.href
        }
      })
    });
    const posts = oldPosts.concat(loadedPosts);
    // remove duplicates
    const filteredPosts = posts.filter((post) => {
      const samePosts = posts.filter((value) => value.link == post.link);
      if(samePosts.length > 1) return false;
      return true;
    });
    if(filteredPosts.length > minLength) return filteredPosts;
    const result = await scroll(filteredPosts, minLength);
    return result;
  }
  const posts = possibleMinLength == 0 ? [] : await scroll([], (possibleMinLength - 1));

  // add click function to posts array
  const result = posts.map((post) => {
    return {
      link: post.link,
      click: () => tools.clickOn(page, "a", { href: post.link }),
      getPost: (state) => getPost(page, post.link, state)
    }
  })

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, posts: result, state: newState };

}
const follow = async (page, username, state = {}) => {

  const newState = await (async () => {
    // check if previous site is page of the user
    if(!state) return;
    if(state.previousSite == `https://www.instagram.com/${username}/`) {
      await page.goBack();
      // update state
      const updatedState = Object.assign(state, { currentSite: state.previousSite, previousSite: null });
      return updatedState;
    }
    return state;
  })();

  // check if link to the username's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: "https://www.instagram.com/" + username + "/"})
  if (linkPresent) await util.wait(1000 * 3);

  // check if bot is already on the page of the user
  if(page.url() != "https://www.instagram.com/" + username + "/" && !linkPresent) {

    // search for username
    const { results } = await search(page, username);

    await util.wait(1000 * 2)
    
    // click on search result for the specific username
    results.forEach((searchResult) => { if(searchResult.username == username) { searchResult.click(); }})

    await util.wait(1000 * 5);

  }

  // click on 'Follow' button
  await tools.clickOnButton(page, "Follow");

  // click on 'Follow Back' button
  await tools.clickOnButton(page, "Follow Back");

  // wait
  await util.wait(1000 * 2);

  return { error: false, state: Object.assign(newState, { currentSite: page.url() }) }

}
const unfollow = async (page, username, state = {}) => {

  // check if link to the username's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: "https://www.instagram.com/" + username + "/"})
  if (linkPresent) await util.wait(1000 * 3);

  // check if bot is already on the page of the user
  if(page.url() != "https://www.instagram.com/" + username + "/" && !linkPresent) {

    // search for username
    const { results } = await search(page, username);

    await util.wait(1000 * 2);
    
    // click on search result for the specific username
    results.forEach((searchResult) => { if(searchResult.username == username) { searchResult.click(); }})
    await util.wait(1000 * 5);

  }

  // click on 'Requested' button if the person hasn't accepted yet
  await tools.clickOnButton(page, "Requested");

  // click on 'Unfollow' button
  await tools.clickOn(page, "[aria-label='Following']");
  await util.wait(1000 * 2);

  // click on 'Unfollow' when Popup appears
  await tools.clickOnButton(page, "Unfollow");

  // wait
  await util.wait(1000 * 2);

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, state: newState }

}
const getProfile = async (page, username, state = {}) => {

  // check if link to the username's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: "https://www.instagram.com/" + username + "/" });
  if (linkPresent) await util.wait(1000 * 3);

  // check if bot is already on the page of the user
  if (page.url() != "https://www.instagram.com/" + username + "/" && !linkPresent) {

    // search for username
    const { results } = await search(page, username);

    // click on search result for the specific username
    results.forEach((searchResult) => { if (searchResult.username == username) { searchResult.click(); } })
    await util.wait(1000 * 5);

  }

  const updatedState = Object.assign((state ? state : {}), { previousSite: null, currentSite: page.url() });

  // get Follower Number
  const followerCount = await page.evaluate(() => {
    try {
      const elements = [...document.querySelectorAll("a")];
      const filtered = elements.filter((element) => element.href.endsWith("/followers/"));
      return filtered[0].children[0].innerText;
    } catch(e) { 
      // fallback method for private accounts
      const elements = document.querySelectorAll(".g47SY");
      return elements[1].innerText;
    }
  })

  // get Following Number
  const followingCount = await page.evaluate(() => {
    try {
      const elements = [...document.querySelectorAll("a")];
      const filtered = elements.filter((element) => element.href.endsWith("/following/"));
      return filtered[0].children[0].innerText;
    } catch(e) { 
      // fallback method for private accounts
      const elements = document.querySelectorAll(".g47SY");
      return elements[2].innerText;
    }
  })

  return {
    error: false,
    getFollowing: (minLength, state) => getFollowing(page, username, minLength, state),
    getFollower: (minLength, state) => getFollower(page, username, minLength, state),
    followerCount,
    followingCount,
    follow: (state) => follow(page, username, state),
    unfollow: (state) => unfollow(page, username, state),
    getPosts: (minLength, state) => getPosts(page, username, minLength, state),
    state: updatedState
  }

}
// post
const likePost = async (page, post, state = {}) => {

  // check if link to the post's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: post })
  if (linkPresent) await util.wait(1000 * 3);

  // goto page of the post
  if(page.url() != post && !linkPresent) await page.goto(post);
  await util.wait(1000 * 3);

  // check if post's page exists
  const postExists = await pageExists(page);
  if(!postExists) return errorMessage.postNotFound;

  // click on like symbol
  await page.evaluate(() => {
    const elements = document.querySelectorAll("[aria-label='Like']");
    elements.forEach((el) => el.parentElement.click());
  })

  // click on close button
  if(linkPresent) await page.evaluate(() => {
    try {
    const elements = [...document.querySelectorAll("[aria-label='Close']")];
    elements[0].parentNode.click();
    } catch(e) { console.log("Error in likePost: " + e)}
  })

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, state: newState }

}
const unlikePost = async (page, post, state = {}) => {

  // check if link to the post's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: post })
  if (linkPresent) await util.wait(1000 * 3);

  // goto page of the post
  if(page.url() != post) await page.goto(post);
  await util.wait(1000 * 3);

  // check if post's page exists
  const postExists = await pageExists(page);
  if(!postExists) return errorMessage.postNotFound;

  // click on unlike symbol
  await page.evaluate(() => {
    try {
    const elements = document.querySelectorAll("[aria-label='Unlike']");
    elements.forEach((el) => el.parentElement.click());
    } catch(e) { console.log("Error in unlikePost: " + e)}
  })

  // click on close button
  if(linkPresent) await page.evaluate(() => {
    try {
    const elements = [...document.querySelectorAll("[aria-label='Close']")];
    elements[0].parentNode.click();
    } catch(e) { console.log("Error in unlikePost: " + e)}
  })

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, state: newState }

}
const commentPost = async (page, post, comment, state = {}) => {

  // check if link to the post's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: post })
  if (linkPresent) await util.wait(1000 * 3);

  // goto page of the post
  if(page.url() != post) await page.goto(post);
  await util.wait(1000 * 3);

  // check if post's page exists
  const postExists = await pageExists(page);
  if(!postExists) return errorMessage.postNotFound;

  // enter comment into the text area
  await page.type("[aria-label='Add a comment…']", comment);
  
  // click on Post button
  await tools.clickOn(page, "button", { innerHTML: 'Post' });

  // click on close button
  if(linkPresent) await page.evaluate(() => {
    try {
    const elements = [...document.querySelectorAll("[aria-label='Close']")];
    elements[0].parentNode.click();
    } catch(e) {
      console.log("Error in commentPost: " + e);
    }
  })

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, state: newState }

}
const getComments = async (page, post, minComments = 1, state = {}) => {

  // check if link to the post's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: post })
  if (linkPresent) await util.wait(1000 * 3);

  // goto page of the post
  if(page.url() != post) await page.goto(post);
  await util.wait(1000 * 3);

  // check if post's page exists
  const postExists = await pageExists(page);
  if(!postExists) return errorMessage.postNotFound;

  // load comments
  const scroll = async (oldComments, minComments) => {
    await tools.scrollBy(page, 1000, ".XQXOT");
    await util.wait(1000 * 1);
    const loadedComments = await page.evaluate(() => {
      const box = document.querySelector(".XQXOT");
      const elements = [...box.querySelectorAll(".C4VMK")];
      const comments = elements.map((element) => {
        return {
          "username": element.querySelector("a").innerText,
          "text": element.querySelectorAll("span")[element.querySelectorAll("span").length - 1].innerText 
        }
      })
      return comments;
    })
    const comments = oldComments.concat(loadedComments);
    // remove duplicates
    const filteredComments = comments.filter((comment) => {
      const sameComments = comments.filter((value) => value.text == comment.text && value.username == comment.username);
      if(sameComments.length > 1) return false;
      return true;
    });
    if(filteredComments.length >= minComments) return filteredComments;
    // click on 'Load more comments' button
    await page.evaluate(() => {
      const loadCommentsButton = document.querySelector("[aria-label='Load more comments']");
      if(loadCommentsButton) loadCommentsButton.click();
    })
    await util.wait(1000 * 1);
    const result = await scroll(filteredComments, minComments);
    return result;
  }
  const comments = await scroll([], minComments);

  // add getAuthor func to result
  const formattedComments = comments.map((comment) => Object.assign(comment, { author: { username: comment.username, getProfile: (state) => getProfile(page, comment.username, state) } }));

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return { error: false, comments: formattedComments, state: newState };

}
const getPost = async (page, post, state = {}) => {

  // check if link to the post's site is present on the site
  const linkPresent = await tools.clickOnOne(page, "a", { href: post });
  if(linkPresent) await util.wait(1000 * 5);

  // goto page of the post
  if(page.url() != post && !linkPresent) { 
    await page.goto(post);
    await util.wait(1000 * 3);
  }

  // check if post's page exists
  const postExists = await pageExists(page);
  if(!postExists) return errorMessage.postNotFound;

  // get username of the post's author
  const username = await page.evaluate(() => {
    const element = document.querySelectorAll(".Jv7Aj")[1].children[0];
    return element.innerText;
  })

  // update state
  const newState = Object.assign(state, { currentSite: page.url(), previousSite: state.currentSite })

  return {
    error: false,
    author: {
      username,
      getProfile: (state) => getProfile(page, username, state),
    },
    like: (state) => likePost(page, post, state),
    unlike: (state) => unlikePost(page, post, state),
    comment: (comment, state) => commentPost(page, post, comment, state),
    getComments: (minComments, state) => getComments(page, post, minComments, state), 
    state: newState
  }

}


/* interface */
const launchBot = async (browserArgs) => {

  const browser = await launchBrowser(browserArgs);
  const page = await newPage(browser, "https://www.instagram.com/");

  return {
    browser,
    page,
    login: (username, password) => login(page, username, password),
    logout: (username) => logout(page, username),
    search: (term) => search(page, term),
    getFollowing: (username, minLength) => getFollowing(page, username, minLength),
    getFollower: (username, minLength) => getFollower(page, username, minLength),
    getPosts: (username, minLength) => getPosts(page, username, minLength),
    follow: (username) => follow(page, username),
    unfollow: (username) => unfollow(page, username),
    likePost: (post) => likePost(page, post),
    unlikePost: (post) => unlikePost(page, post),
    commentPost: (post, comment) => commentPost(page, post, comment),
    exploreHashtag: (hashtag, minPosts) => exploreHashtag(page, hashtag, minPosts),
    getComments: (post, minComments) => getComments(page, post, minComments),
    screenshot: (path) => screenshot(page, path),
    getProfile: (username) => getProfile(page, username),
    getPost: (post) => getPost(page, post)
  }

}

module.exports = { launchBot }