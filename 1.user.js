// ==UserScript==
// @name         ChatGPT Session导入（JSON两次拼接-调试兜底版）
// @namespace    http://violentmonkey.net/
// @version      1.2
// @description  分两次粘贴JSON，全程弹窗提示，自动兼容API，失败强制降级
// @match        https://chatgpt.com/*
// @run-at       document-end
// @grant        GM.cookie
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';
    const SPLIT_MAX = 4000;
    const COOKIE_DOMAIN = ".chatgpt.com";
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "lax";

    // 自动兼容两种API命名（点语法/下划线语法）
    const getCookieApi = () => {
        if (typeof GM?.cookie?.set === "function") return GM.cookie;
        if (typeof GM_cookie?.set === "function") return GM_cookie;
        return null;
    };

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

    // JSON清洗修复（去空白、提取有效结构、补全闭合括号）
    function cleanAndParseJSON(rawStr) {
        let clean = rawStr.replace(/[\n\r\t\s]/g, "");
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error("两段拼接后未找到JSON结构，请确认拆分位置正确");
        clean = clean.slice(start, end + 1);
        // 自动补全缺失的闭合括号
        let openCount = (clean.match(/\{/g) || []).length;
        let closeCount = (clean.match(/\}/g) || []).length;
        if (openCount > closeCount) clean += '}'.repeat(openCount - closeCount);
        try {
            return JSON.parse(clean);
        } catch (e) {
            throw new Error("JSON格式损坏，请调整拆分位置，从逗号/引号处断开再重试");
        }
    }

    // Token分片
    function splitSessionToken(fullStr) {
        const chunk0 = fullStr.slice(0, SPLIT_MAX);
        const chunk1 = fullStr.slice(SPLIT_MAX);
        return [chunk0, chunk1];
    }

    // 写入Cookie核心逻辑
    async function writeCookies(cookieApi, chunk0, chunk1, expireSec) {
        try {
            await cookieApi.delete({name:"__Secure-next-auth.session-token0", domain:COOKIE_DOMAIN, path:COOKIE_PATH});
            await cookieApi.delete({name:"__Secure-next-auth.session-token1", domain:COOKIE_DOMAIN, path:COOKIE_PATH});
        } catch(e) { console.warn("旧Cookie清理失败", e); }

        await cookieApi.set({
            name:"__Secure-next-auth.session-token0", value:chunk0,
            domain:COOKIE_DOMAIN, path:COOKIE_PATH, secure:true,
            sameSite:COOKIE_SAMESITE, httpOnly:true, expirationDate:expireSec
        });
        await cookieApi.set({
            name:"__Secure-next-auth.session-token1", value:chunk1,
            domain:COOKIE_DOMAIN, path:COOKIE_PATH, secure:true,
            sameSite:COOKIE_SAMESITE, httpOnly:true, expirationDate:expireSec
        });
    }

    function bindClickEvent(btn) {
        btn.addEventListener('click', async ()=>{
            try {
                // 两次输入
                const part1 = prompt("【1/2】粘贴完整JSON的前半段");
                if(!part1?.trim()) return;
                const part2 = prompt("【2/2】粘贴完整JSON的后半段");
                if(!part2?.trim()) return;

                alert("正在拼接并解析JSON...");
                const fullJson = part1.trim() + part2.trim();
                const sessionData = cleanAndParseJSON(fullJson);
                const fullToken = sessionData.sessionToken;
                if(!fullToken) throw new Error("JSON中未找到sessionToken字段");
                const expireSec = Math.floor(new Date(sessionData.expires).getTime() / 1000);
                const [c0, c1] = splitSessionToken(fullToken);

                alert("JSON解析成功，正在尝试写入Cookie...");
                const cookieApi = getCookieApi();
                
                if (cookieApi) {
                    try {
                        await writeCookies(cookieApi, c0, c1, expireSec);
                        alert("✅ 写入成功！3秒后自动刷新页面登录");
                        setTimeout(()=>location.reload(), 3000);
                        return;
                    } catch (writeErr) {
                        alert("❌ Cookie自动写入失败，已降级为手动复制模式\n\n错误原因：" + writeErr.message);
                    }
                } else {
                    alert("⚠️ 未检测到Cookie写入权限，进入手动复制模式");
                }

                // 强制降级：弹窗输出两段Token，手动新建
                alert(`请手动复制两段新建Cookie：\n\n=== token0（前4000字符）===\n${c0}\n\n=== token1（剩余字符）===\n${c1}\n\n固定参数：域.chatgpt.com、路径/、勾选Secure和HttpOnly、SameSite选Lax`);

            } catch(err) {
                alert("❌ 处理失败：" + err.message);
                console.error(err);
            }
        });
    }

    // 加载按钮
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', createFloatButton);
    } else {
        createFloatButton();
    }
})();
