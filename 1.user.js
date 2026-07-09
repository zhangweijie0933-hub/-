// ==UserScript==
// @name         ChatGPT Session导入（完整JSON两次拼接版）
// @namespace    http://violentmonkey.net/
// @version      1.0
// @description  分两次粘贴完整JSON前后段，自动拼接解析写入Cookie
// @match        https://chatgpt.com/*
// @run-at       document-end
// @grant        GM.cookie
// @grant        GM.notification
// ==/UserScript==

(function() {
    'use strict';
    const SPLIT_MAX = 4000;
    const COOKIE_DOMAIN = ".chatgpt.com";
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "lax";

    // 移动端悬浮按钮
    function createFloatButton() {
        if(document.getElementById('gptSessionImportBtn')) return;
        const btn = document.createElement('button');
        btn.id = 'gptSessionImportBtn';
        btn.innerText = '导入Session';
        Object.assign(btn.style, {
            position: 'fixed', bottom: '24px', left: '16px', zIndex: '999999',
            padding: '12px 18px', background: '#10a37f', color: '#fff',
            border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px'
        });
        document.body.appendChild(btn);
        bindClickEvent(btn);
    }

    // JSON清洗修复（自动去换行、提取有效JSON、补全闭合括号）
    function cleanAndParseJSON(rawStr) {
        let clean = rawStr.replace(/[\n\r\t]/g, "");
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error("未检测到JSON结构，请确认粘贴内容正确");
        clean = clean.slice(start, end + 1);
        // 自动补全缺失的闭合括号
        let openCount = (clean.match(/\{/g) || []).length;
        let closeCount = (clean.match(/\}/g) || []).length;
        if (openCount > closeCount) clean += '}'.repeat(openCount - closeCount);
        try {
            return JSON.parse(clean);
        } catch (e) {
            throw new Error("JSON拼接后格式损坏，请调整拆分位置重新粘贴");
        }
    }

    // Token分片校验
    function splitSessionToken(fullStr) {
        const chunk0 = fullStr.slice(0, SPLIT_MAX);
        const chunk1 = fullStr.slice(SPLIT_MAX);
        if (chunk0 + chunk1 !== fullStr) alert("分片警告：Token存在截断丢失");
        return [chunk0, chunk1];
    }

    // 写入Cookie核心逻辑
    async function writeCookies(chunk0, chunk1, expireTime) {
        // 清理旧Cookie
        try {
            await GM.cookie.delete({name:"__Secure-next-auth.session-token0", domain:COOKIE_DOMAIN, path:COOKIE_PATH});
            await GM.cookie.delete({name:"__Secure-next-auth.session-token1", domain:COOKIE_DOMAIN, path:COOKIE_PATH});
        } catch(e) { console.warn("旧Cookie清理失败，跳过", e); }

        // 写入两条分片Cookie
        await GM.cookie.set({
            name:"__Secure-next-auth.session-token0", value:chunk0,
            domain:COOKIE_DOMAIN, path:COOKIE_PATH, secure:true,
            sameSite:COOKIE_SAMESITE, httpOnly:true, expirationDate:expireTime
        });
        await GM.cookie.set({
            name:"__Secure-next-auth.session-token1", value:chunk1,
            domain:COOKIE_DOMAIN, path:COOKIE_PATH, secure:true,
            sameSite:COOKIE_SAMESITE, httpOnly:true, expirationDate:expireTime
        });

        try { GM.notification({title:"导入成功", text:"3秒后自动刷新登录"}); }
        catch(e) { alert("导入成功，3秒后自动刷新"); }
        setTimeout(()=>location.reload(), 3000);
    }

    // 点击主逻辑：两次粘贴拼接JSON
    function bindClickEvent(btn) {
        btn.addEventListener('click', async ()=>{
            try {
                const jsonPart1 = prompt("第1步：粘贴完整JSON的前半段");
                if(!jsonPart1?.trim()) return;
                const jsonPart2 = prompt("第2步：粘贴完整JSON的后半段");
                if(!jsonPart2?.trim()) return;

                // 拼接两段完整JSON
                const fullJsonStr = jsonPart1.trim() + jsonPart2.trim();
                // 清洗+解析JSON
                const sessionData = cleanAndParseJSON(fullJsonStr);
                const fullToken = sessionData.sessionToken;
                if(!fullToken) throw new Error("JSON中未找到sessionToken字段");
                const expireSec = Math.floor(new Date(sessionData.expires).getTime() / 1000);
                const [c0, c1] = splitSessionToken(fullToken);

                // 检测GM权限，不可用则降级手动复制
                if(typeof GM?.cookie?.set === "function") {
                    await writeCookies(c0, c1, expireSec);
                } else {
                    alert(`Cookie权限不可用，手动复制两段新建Cookie：\n\n=== token0 ===\n${c0}\n\n=== token1 ===\n${c1}`);
                }
            } catch(err) {
                alert("处理失败：" + err.message);
                console.error(err);
            }
        });
    }

    // 加载按钮
    document.readyState === "loading"
        ? document.addEventListener('DOMContentLoaded', createFloatButton)
        : createFloatButton();
})();
