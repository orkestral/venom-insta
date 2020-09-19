const newPage = async (browser, url) => {
    // create page
    const page = await browser.newPage();
    // change language
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en'
    });
    // set url
    await page.goto(url);
    return page;
}
const evaluate = async (page, js, args) => {
    const result = await page.evaluate(js, args);
    return result;
}
const clickOn = async (page, querySelector, property) => {
    await evaluate(page, (args) => {
        const elements = [...document.querySelectorAll(args.querySelector)];
        const keysProp = Object.keys((args.property ? args.property : {}));
        elements.forEach((element) => {
            const matchesProperties = keysProp.reduce((acc, cur) => {
                if (args.property[cur] == element[cur]) return true;
                return false;
            }, true)
            if (matchesProperties) element.click();
        })
    }, { querySelector, property })
}
const clickOnOne = async (page, querySelector, property) => {
    const clickedElement = await evaluate(page, (args) => {
        const elements = [...document.querySelectorAll(args.querySelector)];
        const keysProp = Object.keys((args.property ? args.property : {}));
        const clickedElement = elements.reduce((alreadyClicked, element) => {
            if(alreadyClicked) return true;
            const matchesProperties = keysProp.reduce((acc, cur) => {
                if (args.property[cur] == element[cur]) return true;
                return false;
            }, true)
            if (matchesProperties) {
                element.click();
                return true;
            }
            return alreadyClicked;
        }, false)
        return clickedElement;
    }, { querySelector, property })
    return clickedElement;
}
const clickOnButton = async (page, buttonText) => {
    await clickOn(page, "button", { innerText: buttonText });
}
const clickOnDiv = async (page, text) => {
    await evaluate(page, (innerText) => {
        const matchingDivs = [...document.querySelectorAll("div")];
        matchingDivs.forEach((div) => {
            if (div.innerText === innerText) div.click();
        })
    }, text);
}
const scrollBy = async (page, scroll, boxSelector) => {
    await evaluate(page, async ({ boxSelector, scroll }) => {
        const box = boxSelector ? document.querySelector(boxSelector) : document.scrollingElement;
        box.scrollBy(0, scroll);
    }, { boxSelector, scroll })
}
const scroll = async (page, boxSelector) => {
    await evaluate(page, async (boxSelector) => {
        const box = boxSelector ? document.querySelector(boxSelector) : document.scrollingElement;
        const scroll = async (box, scrollTop) => {
            box.scrollBy(0, 1000);
            // wait for 1 second
            await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
            if (scrollTop != box.scrollTop) await scroll(box, box.scrollTop);
        }
        await scroll(box, box.scrollTop);
    }, boxSelector)
}

module.exports = {
    newPage,
    evaluate,
    clickOn,
    clickOnOne,
    clickOnButton,
    clickOnDiv,
    scroll,
    scrollBy
}