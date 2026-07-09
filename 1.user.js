// ==UserScript==
// @name         ChatGPT Session 一键导入工具 (Violentmonkey)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  粘贴 session 接口 JSON，自动拆分并写入登录 Cookie（适配 Kiwi，无输入长度限制）
// @author       You
// @match        https://chatgpt.com/*
// @grant        GM_cookie
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    const SPLIT_MAX = 4000;
    const COOKIE_DOMAIN = ".chatgpt.com";
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "lax";

    // 创建浮动按钮（触发输入面板）
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
            padding: '14px 20px',
            background: '#10a37f',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            touchAction: 'manipulation'
        });
        document.body.appendChild(floatBtn);
        floatBtn.addEventListener('click', showInputPanel);
    }

    // 创建输入面板（替代 prompt）
    function showInputPanel() {
        // 移除旧面板
        const oldPanel = document.getElementById('sessionInputPanel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'sessionInputPanel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: '100000',
            background: '#fff',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80%',
            display: 'flex',
            flexDirection: 'column',
            color: '#000'
        });

        const title = document.createElement('div');
        title.innerText = '粘贴完整 JSON（无长度限制）';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.fontSize = '18px';
        panel.appendChild(title);

        const textarea = document.createElement('textarea');
        textarea.placeholder = '请粘贴 https://chatgpt.com/api/auth/session 的完整 JSON 内容...';
        textarea.style.flex = '1';
        textarea.style.height = '200px';
        textarea.style.padding = '10px';
        textarea.style.fontSize = '14px';
        textarea.style.border = '1px solid #ccc';
        textarea.style.borderRadius = '6px';
        textarea.style.resize = 'vertical';
        textarea.style.minHeight = '150px';
        textarea.style.color = '#000';
        panel.appendChild(textarea);

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.marginTop = '12px';
        btnContainer.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = '取消';
        cancelBtn.style.padding = '8px 16px';
        cancelBtn.style.border = '1px solid #ccc';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.background = '#f0f0f0';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.addEventListener('click', () => panel.remove());

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = '确认导入';
        confirmBtn.style.padding = '8px 16px';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '6px';
        confirmBtn.style.background = '#10a37f';
        confirmBtn.style.color = '#fff';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.fontWeight = 'bold';
        confirmBtn.addEventListener('click', () => {
            const rawInput = textarea.value;
            panel.remove();
            processInput(rawInput);
        });

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(confirmBtn);
        panel.appendChild(btnContainer);

        // 点击外部关闭（可选）
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.4)';
        overlay.style.zIndex = '99999';
        overlay.id = 'sessionOverlay';
        overlay.addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });
        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // 自动聚焦到 textarea
        setTimeout(() => textarea.focus(), 100);
    }

    // 处理输入内容
    async function processInput(rawInput) {
        if (!rawInput?.trim()) {
            GM_notification({ title: "提示", text: "输入内容为空" });
            return;
        }

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
    }

    // Token 分片 + 完整性校验
    function splitSessionToken(fullStr) {
        const chunk0 = fullStr.slice(0, SPLIT_MAX);
        const chunk1 = fullStr.slice(SPLIT_MAX);
        const mergeTest = chunk0 + chunk1;
        if (mergeTest.length !== fullStr.length) {
            GM_notification({
                title: "分片警告",
                text: "Token 截断丢失字符，建议检查完整度"
            });
        }
        return [chunk0, chunk1];
    }

    // 批量设置 Cookie
    async function setSessionCookies(chunk0, chunk1, expireTime) {
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
                expiration: expireTime
            });
        }

        GM_notification({
            title: "✅ 导入完成",
            text: "3 秒后自动刷新页面登录账号"
        });
        setTimeout(() => window.location.reload(), 3000);
    }

    // 页面加载完成后创建按钮
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', createFloatButton);
    } else {
        createFloatButton();
    }
})();
