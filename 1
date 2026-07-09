// ==UserScript==
// @name         ChatGPT Session 一键导入工具 (Violentmonkey)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  粘贴 session 接口 JSON，自动拆分并写入登录 Cookie（适配 Kiwi 暴力猴）
// @author       You
// @match        https://chatgpt.com/*
// @grant        GM_cookie
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    const SPLIT_MAX = 4000;                 // 单段最大长度（安全分割）
    const COOKIE_DOMAIN = ".chatgpt.com";
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "lax";

    // ---------- 创建浮动按钮（移动端增大触控区域） ----------
    function createFloatButton() {
        if (document.getElementById('gptSessionImportBtn')) return;
        const floatBtn = document.createElement('button');
        floatBtn.id = 'gptSessionImportBtn';
        floatBtn.innerText = '导入 Session';
        Object.assign(floatBtn.style, {
            position: 'fixed',
            top: '120px',
            right: '20px',
            zIndex: '99999',
            padding: '14px 20px',            // 移动端更大的点击区域
            background: '#10a37f',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            touchAction: 'manipulation'      // 提升触控响应
        });
        document.body.appendChild(floatBtn);
        bindClickEvent(floatBtn);
    }

    // ---------- Token 分片 + 完整性校验 ----------
    function splitSessionToken(fullStr) {
        const chunk0 = fullStr.slice(0, SPLIT_MAX);
        const chunk1 = fullStr.slice(SPLIT_MAX);
        const mergeTest = chunk0 + chunk1;
        if (mergeTest.length !== fullStr.length) {
            GM_notification({
                title: "分片警告",
                text: "Token 截断丢失字符，建议手动复制两段使用"
            });
        }
        return [chunk0, chunk1];
    }

    // ---------- 批量设置 Cookie（适配 Violentmonkey） ----------
    async function setSessionCookies(chunk0, chunk1, expireTime) {
        // 先删除旧 Cookie（Violentmonkey 的 GM_cookie.delete 支持 Promise）
        await GM_cookie.delete({
            name: "__Secure-next-auth.session-token0",
            domain: COOKIE_DOMAIN,
            path: COOKIE_PATH
        });
        await GM_cookie.delete({
            name: "__Secure-next-auth.session-token1",
            domain: COOKIE_DOMAIN,
            path: COOKIE_PATH
        });

        const cookieList = [
            { name: "__Secure-next-auth.session-token0", value: chunk0 },
            { name: "__Secure-next-auth.session-token1", value: chunk1 }
        ];

        for (const item of cookieList) {
            await GM_cookie.set({
                name: item.name,
                value: item.value,
                domain: COOKIE_DOMAIN,
                path: COOKIE_PATH,
                secure: true,
                sameSite: COOKIE_SAMESITE,
                httpOnly: true,
                expiration: expireTime      // 秒级时间戳
            });
        }

        GM_notification({
            title: "✅ 导入完成",
            text: "3 秒后自动刷新页面登录账号"
        });
        setTimeout(() => window.location.reload(), 3000);
    }

    // ---------- 按钮点击主逻辑 ----------
    function bindClickEvent(btn) {
        btn.addEventListener('click', async () => {
            const rawInput = prompt("粘贴 https://chatgpt.com/api/auth/session 的完整 JSON 内容：");
            if (!rawInput?.trim()) return;

            try {
                // 清洗并提取 JSON
                const cleanText = rawInput.replace(/[\n\r]/g, "").match(/\{.*\}/)?.[0];
                if (!cleanText) throw new Error("未检测到合法 JSON，请重新粘贴完整 session 内容");

                const sessionData = JSON.parse(cleanText);
                const fullToken = sessionData.sessionToken;
                if (!fullToken) throw new Error("JSON 中未找到 sessionToken 字段");

                const [c0, c1] = splitSessionToken(fullToken);
                const expireTs = Math.floor(new Date(sessionData.expires).getTime() / 1000);
                await setSessionCookies(c0, c1, expireTs);

            } catch (err) {
                GM_notification({
                    title: "❌ 处理失败",
                    text: err.message
                });
                console.error("Session 导入错误：", err);
            }
        });
    }

    // ---------- 页面加载完成后创建按钮 ----------
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', createFloatButton);
    } else {
        createFloatButton();
    }
})();
