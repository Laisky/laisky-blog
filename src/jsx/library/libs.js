'use strict';

import PouchDB from 'pouchdb';
import * as marked from 'marked';
import { sha256 } from 'js-sha256';
import * as bootstrap from 'bootstrap';

/**
 * load js modules by urls
 *
 * @param {*} moduleUrls array of module urls
 * @param {*} moduleType script type, default is 'text/javascript'
 */
export const LoadJsModules = async (moduleUrls, moduleType) => {
    moduleType = moduleType || 'text/javascript';
    const promises = moduleUrls.map((moduleUrl) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = moduleUrl;
            script.type = moduleType;
            script.async = false;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    });

    await Promise.all(promises);
};

/**
 * async wait for milliseconds
 *
 * @param {*} milliseconds
 * @returns
 */
export const Sleep = async (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

export const ActiveElementsByID = (elements, id) => {
    for (let i = 0; i < elements.length; i++) {
        const item = elements[i];
        if (item.id === id) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    }
};

export const ActiveElementsByData = (elements, dataKey, dataVal) => {
    for (let i = 0; i < elements.length; i++) {
        const item = elements[i];
        if (item.dataset[dataKey] === dataVal) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    }
};

export const DateStr = () => {
    const now = new Date();

    const year = now.getUTCFullYear();
    let month = now.getUTCMonth() + 1; // Months are 0-based, so we add 1
    let day = now.getUTCDate();
    let hours = now.getUTCHours();
    let minutes = now.getUTCMinutes();
    let seconds = now.getUTCSeconds();

    // Pad the month, day, hours, minutes and seconds with leading zeros, if required
    month = (month < 10 ? '0' : '') + month;
    day = (day < 10 ? '0' : '') + day;
    hours = (hours < 10 ? '0' : '') + hours;
    minutes = (minutes < 10 ? '0' : '') + minutes;
    seconds = (seconds < 10 ? '0' : '') + seconds;

    // Compose the date string
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// {key: [callback1, callback2, {name, callback}]}
const kvListeners = {};
let kv;

function initKv() {
    if (!kv) {
        kv = new PouchDB('mydatabase');
    }
}

export const KvOp = Object.freeze({
    SET: 1,
    DEL: 2
});

/**
 * Add listener for keyPrefix
 *
 * @param {str} keyPrefix
 * @param {function} callback - function(keyPrefix, op, oldVal, newVal)
 * @param {str} callbackName - optional, name of the callback. If provided, it will overwrite the existing callback with the same name
 */
export const KvAddListener = (keyPrefix, callback, callbackName) => {
    initKv();
    if (!kvListeners[keyPrefix]) {
        kvListeners[keyPrefix] = [];
    }

    if (kvListeners[keyPrefix].indexOf(callback) === -1) {
        if (callbackName) {
            // check whether callbackName is already used, if yes, overwrite it
            let found = false;
            for (let i = 0; i < kvListeners[keyPrefix].length; i++) {
                if (typeof kvListeners[keyPrefix][i] === 'object' && kvListeners[keyPrefix][i].name === callbackName) {
                    kvListeners[keyPrefix][i].callback = callback;
                    found = true;
                    break;
                }
            }

            if (!found) {
                kvListeners[keyPrefix].push({ name: callbackName, callback });
            }
        } else {
            kvListeners[keyPrefix].push(callback);
        }
    }
};

/**
 * Remove listener for keyPrefix by callbackName
 *
 * @param {str} keyPrefix
 * @param {str} callbackName
 */
export const KvRemoveListener = (keyPrefix, callbackName) => {
    if (!kvListeners[keyPrefix]) {
        return;
    }

    for (let i = 0; i < kvListeners[keyPrefix].length; i++) {
        if (typeof kvListeners[keyPrefix][i] === 'object' && kvListeners[keyPrefix][i].name === callbackName) {
            kvListeners[keyPrefix].splice(i, 1);
            break;
        }
    }
};

/**
 * Set data to indexeddb
 *
 * @param {str} key - key
 * @param {any} val - value
 */
export const KvSet = async (key, val) => {
    initKv();
    console.debug(`KvSet: ${key}: ${val}`);
    const marshaledVal = JSON.stringify(val);

    let oldVal;
    try {
        let oldDocu = null;
        try {
            oldDocu = await kv.get(key);
            oldVal = oldDocu ? JSON.parse(oldDocu.val) : null;
        } catch (error) {
            if (error.status !== 404) {
                throw error;
            }
        }

        await kv.put({
            _id: key,
            _rev: oldDocu ? oldDocu._rev : undefined,
            val: marshaledVal
        });
    } catch (error) {
        if (error.status === 409) {
            // ignore conflict error
            return;
        }

        console.error(`KvSet for key ${key}, val ${marshaledVal} failed: ${error}`);
        throw error;
    }

    // notify listeners
    Object.keys(kvListeners).forEach((keyPrefix) => {
        if (key.startsWith(keyPrefix)) {
            for (let i = 0; i < kvListeners[keyPrefix].length; i++) {
                const callbackObj = kvListeners[keyPrefix][i];
                if (typeof callbackObj === 'object') {
                    callbackObj.callback(key, KvOp.SET, oldVal, val);
                } else {
                    callbackObj(key, KvOp.SET, oldVal, val);
                }
            }
        }
    });
};

/** get data from indexeddb
 *
 * @param {str} key
 * @returns null if not found
 */
export const KvGet = async (key) => {
    initKv();
    console.debug(`KvGet: ${key}`);
    try {
        const doc = await kv.get(key);
        if (!doc || !doc.val) {
            return null;
        }

        return JSON.parse(doc.val);
    } catch (error) {
        if (error.status === 404) {
            // Ignore not found error
            return null;
        }

        throw error;
    }
};

/** check if key exists in indexeddb
 *
 * @param {*} key
 * @returns true if exists, false otherwise
 */
export const KvExists = async (key) => {
    initKv();
    console.debug(`KvExists: ${key}`);
    try {
        await kv.get(key);
        return true;
    } catch (error) {
        if (error.status === 404) {
            // Ignore not found error
            return false;
        }

        throw error;
    }
};

/** rename key in indexeddb
 *
 * @param {str} oldKey
 * @param {str} newKey
 */
export const KvRename = async (oldKey, newKey) => {
    initKv();
    console.debug(`KvRename: ${oldKey} -> ${newKey}`);
    const oldVal = await KvGet(oldKey);
    if (!oldVal) {
        return
    }

    await KvSet(newKey, oldVal);
    await KvDel(oldKey);
};

// delete data from indexeddb
export const KvDel = async (key) => {
    initKv();
    console.debug(`KvDel: ${key}`);
    let oldVal = null;
    try {
        const doc = await kv.get(key);
        oldVal = JSON.parse(doc.val);
        await kv.remove(doc);
    } catch (error) {
        // ignore not found error
        if (error.status !== 404) {
            throw error;
        }
    }

    // notify listeners
    Object.keys(kvListeners).forEach((keyPrefix) => {
        if (key.startsWith(keyPrefix)) {
            for (let i = 0; i < kvListeners[keyPrefix].length; i++) {
                const callbackObj = kvListeners[keyPrefix][i];
                if (typeof callbackObj === 'object') {
                    callbackObj.callback(key, KvOp.DEL, oldVal, null);
                } else {
                    callbackObj(key, KvOp.DEL, oldVal, null);
                }
            }
        }
    });
};

// list all keys from indexeddb
export const KvList = async () => {
    initKv();
    console.debug('KvList');
    const docs = await kv.allDocs({ include_docs: true });
    const keys = [];
    for (let i = 0; i < docs.rows.length; i++) {
        keys.push(docs.rows[i].doc._id);
    }
    return keys;
};
// clear all data from indexeddb
export const KvClear = async () => {
    initKv();
    console.debug('KvClear');

    // notify listeners
    (await KvList()).forEach((key) => {
        Object.keys(kvListeners).forEach((keyPrefix) => {
            if (key.startsWith(keyPrefix)) {
                for (let i = 0; i < kvListeners[keyPrefix].length; i++) {
                    const callbackObj = kvListeners[keyPrefix][i];
                    if (typeof callbackObj === 'object') {
                        callbackObj.callback(key, KvOp.SET, null, null);
                    } else {
                        callbackObj(key, KvOp.DEL, null, null);
                    }
                }
            }
        });
    });

    await kv.destroy();
    kv = new PouchDB('mydatabase');
};

export const SetLocalStorage = (key, val) => {
    localStorage.setItem(key, JSON.stringify(val));
};
export const GetLocalStorage = (key) => {
    const v = localStorage.getItem(key);
    if (v) {
        return JSON.parse(v);
    } else {
        return v;
    }
};

/**
 * render markdown to html
 *
 * @param {str} markdownString -
 * @returns
 */
export const Markdown2HTML = async (markdownString) => {
    if (!marked) {
        await LoadJsModules([
            'https://s3.laisky.com/static/marked/12.0.1/lib/marked.umd.js',
            'https://s3.laisky.com/static/mermaid/10.9.0/dist/mermaid.min.js'
        ]);
    }

    const renderer = new marked.Renderer();
    renderer.code = (code, language) => {
        code = sanitizeHTML(code);
        if (code.match(/^sequenceDiagram/) || code.match(/^graph/)) {
            return '<pre class="mermaid">' + code + '</pre>';
        } else {
            return `<pre class="language-${language}"><code class="language-${language}">` + code + '</code></pre>';
        }
    }
    marked.use({ renderer });

    return marked.parse(markdownString);
};

export const ScrollDown = (element) => {
    element.scrollTo({
        top: element.scrollHeight,
        left: 0,
        behavior: 'smooth' // 可加入平滑过渡效果
    });
};

export const TrimSpace = (str) => {
    return str.replace(/^[\s\n]+|[\s\n]+$/g, '');
};

export const RenderStr2HTML = (str) => {
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br/>')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
};

export const SHA256 = async (str) => {
    // http do not support crypto
    if (!crypto || !crypto.subtle) { // http do not support crypto
        return sha256(str);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

export const ready = (fn) => {
    if (document.readyState === 'complete') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
};

export const escapeHtml = (str) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return str.replace(/[&<>"']/g, function (m) { return map[m] });
};

/**
 * enable bootstrap tooltips for all elements with data-bs-toggle="tooltip"
 */
export const EnableTooltipsEverywhere = () => {
    const eles = document.querySelectorAll('[data-bs-toggle="tooltip"]') || [];
    eles.forEach((ele) => {
        if (ele.dataset.bsToggle === 'true') {
            return;
        }

        ele.dataset.bsToggle = 'true';
        return new bootstrap.Tooltip(ele);
    });
};

/**
 * disable bootstrap tooltips for all elements with class="tooltip.bs-tooltip-auto.fade.show"
 */
export const DisableTooltipsEverywhere = () => {
    const eles = document.querySelectorAll('.tooltip.bs-tooltip-auto.fade.show') || [];
    eles.forEach((ele) => {
        ele.remove();
    });
}

// convert blob to hex string
export const blob2Hex = async (blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const hexString = Array.from(uint8Array)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

    return hexString;
};

export const hex2Bytes = (hexString) => {
    const bytePairs = hexString.match(/.{1,2}/g);
    const bytes = bytePairs.map(bytePair => parseInt(bytePair, 16));
    const uint8Array = new Uint8Array(bytes);

    return uint8Array;
};

// convert hex string to blob
export const hex2Blob = (hexString) => {
    const arrayBuffer = hexString.match(/.{1,2}/g)
        .map(byte => parseInt(byte, 16));
    const uint8Array = new Uint8Array(arrayBuffer);
    const blob = new Blob([uint8Array]);

    return blob;
};

// convert string to compressed hex string
export const gzip = async (stringVal) => {
    const blob = new Blob([stringVal], { type: 'text/plain' });
    const s = new CompressionStream('gzip');
    const ps = blob.stream().pipeThrough(s);
    const compressedBlob = await new Response(ps).blob();
    return await blob2Hex(compressedBlob);
};

// convert compressed hex string to decompressed string
export const ungzip = async (hexStringVal) => {
    const blob = hex2Blob(hexStringVal);
    const s = new DecompressionStream('gzip');
    const ps = blob.stream().pipeThrough(s);
    const decompressedBlob = await new Response(ps).blob();
    return await decompressedBlob.text();
};

// sanitize html
export const sanitizeHTML = (str) => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const evtTarget = (evt) => {
    return evt.currentTarget || evt.target;
};

/**
 * Wait for the element to be ready.
 *
 * @param {string} selector - The selector of the element to wait for.
 * @returns {Promise} - The promise that resolves when the element is ready.
 */
export const waitElementReady = (selector, maxWaitSec = 3000) => {
    return new Promise((resolve, reject) => {
        const startAt = Date.now();
        const interval = setInterval(() => {
            const ele = document.querySelector(selector);
            if (ele) {
                clearInterval(interval);
                resolve(ele);
            } else if (Date.now() - startAt > maxWaitSec) {
                clearInterval(interval);
                reject(new Error(`waitElementReady timeout for ${selector}`));
            }
        }, 100);
    });
}

/**
 * Generates a random string of the specified length.
 * @param {number} length - The length of the string to generate.
 * @returns {str} - The generated random string.
 */
export const RandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
};

/**
 * Copy content to clipboard, support both http and https
 *
 * @param {str} content
 */
export const Copy2Clipboard = (content) => {
    if (location.protocol === 'https:') {
        navigator.clipboard.writeText(content);
    } else {
        // compatibility for http site
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

/**
 * Download image to local disk
 *
 * @param {str} b64EncodedImage - base64 encoded image
 */
export const DownloadImage = (b64EncodedImage) => {
    const a = document.createElement('a');
    a.href = b64EncodedImage;
    a.download = 'image.png';
    a.click();
};

/**
 * Check whether it's a touch device
 *
 * @returns true if it's a touch device, false otherwise
 */
export const IsTouchDevice = () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}


/**
 * Get current username
 *
 * @param {string} key
 * @param {string} val
 * @param {number} ttlSeconds
 */
export const SetCache = async (key, val, ttlSeconds) => {
    const cache = {
        val,
        expireAt: Date.now() + ttlSeconds * 1000
    };

    try {
        await KvSet(key, cache);
    } catch (error) {
        console.error(`SetCache failed: ${error}`);
    }
};

/**
 * Get cache
 *
 * @param {string} key
 * @returns null if not found or expired
 */
export const GetCache = async (key) => {
    // Check if 'force' exists in the URL query parameters, ignore cache if true
    if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('force')) {
            return null;
        }
    }

    try {
        const cache = await KvGet(key);
        if (!cache || cache.expireAt < Date.now()) {
            await KvDel(key);
            return null;
        }

        return cache.val;
    } catch (error) {
        console.error(`GetCache failed: ${error}`);
        return null;
    }
};
