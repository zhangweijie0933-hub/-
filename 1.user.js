// ==UserScript==
// @name         ChatGPT Session一键导入(暴力猴手机版)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  适配Kiwi+暴力猴，粘贴session JSON自动拆分写入Cookie
// @author       You
// @match        https://chatgpt.com/*
// @grant        GM_cookie
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    const SPLIT_MAX = 4000;
    const COOKIE_DOMAIN = ".chatgpt.com";
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "lax";

    // ========== 1. 创建移动端友好的悬浮按钮 ==========
    function createFloatButton() {
        if(document.getElementById('gptSessionImportBtn')) return;
        const floatBtn = document.createElement('button');
        floatBtn.id = 'gptSessionImportBtn';
        floatBtn.innerText = '导入Session';
        Object.assign(floatBtn.style, {
            position: 'fixed',
            top: '80px',
            right: '16px',
            zIndex: '999999',
            padding: '12px 16px',
            background: '#10a37f',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        });
        document.body.appendChild(floatBtn);
        floatBtn.addEventListener('click', showInputModal);
    }

    // ========== 2. 自定义长文本输入弹窗(解决字数限制) ==========
    function showInputModal() {
        // 遮罩层
        const mask = document.createElement('div');
        mask.id = 'sessionImportMask';
        Object.assign(mask.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: '9999999',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box'
        });

        // 弹窗容器
        const modal = document.createElement('div');
        Object.assign(modal.style, {
            background: '#fff',
            borderRadius: '10px',
            width: '100%',
            maxWidth: '500px',
            padding: '20px',
            boxSizing: 'border-box'
        });

        // 标题
        const title = document.createElement('h3');
        title.innerText = '粘贴Session完整JSON';
        title.style.margin = '0 0 12px 0';

        // 多行输入框(无字数限制)
        const textarea = document.createElement('textarea');
        textarea.placeholder = '在此粘贴 https://chatgpt.com/api/auth/session 返回的全部内容';
        Object.assign(textarea.style, {
            width: '100%',
            height: '180px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box',
            marginBottom: '12px',
            wordBreak: 'break-all'
        });

        // 按钮组
        const btnWrap = document.createElement('div');
        Object.assign(btnWrap.style, {
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = '取消';
        Object.assign(cancelBtn.style, {
            padding: '8px 16px',
            border: '1px solid #ddd',
            background: '#f5f5f5',
            borderRadius: '6px',
            cursor: 'pointer'
        });
        cancelBtn.onclick = () => document.body.removeChild(mask);

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = '确认导入';
        Object.assign(confirmBtn.style, {
            padding: '8px 16px',
            border: 'none',
            background: '#10a37f',
            color: '#fff',
            borderRadius: '6px',
            cursor: 'pointer'
        });
        confirmBtn.onclick = () => {
            const input = textarea.value.trim();
            if (!input) {
                showTip('请粘贴完整内容', 'error');
                return;
            }
            handleSessionInput(input);
            document.body.removeChild(mask);
        };

        btnWrap.appendChild(cancelBtn);
        btnWrap.appendChild(confirmBtn);
        modal.appendChild(title);
        modal.appendChild(textarea);
        modal.appendChild(btnWrap);
        mask.appendChild(modal);
        document.body.appendChild(mask);
        textarea.focus();
    }

    // ========== 3. 页面内轻提示(替代系统通知) ==========
    function showTip(text, type = 'success') {
        const tip = document.createElement('div');
        tip.innerText = text;
        const bgColor = type === 'error' ? '#e53935' : '#10a37f';
        Object.assign(tip.style, {
            position: 'fixed',
            top: '40%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: bgColor,
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '10000000',
            fontSize: '14px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)'
        });
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), 2500);
    }

    // ========== 4. Token拆分逻辑 ==========
    function splitSessionToken(fullStr) {
        const chunk0 = fullStr.slice(0, SPLIT_MAX);
        const chunk1 = fullStr.slice(SPLIT_MAX);
        // 校验完整性
        if (chunk0.length + chunk1.length !== fullStr.length) {
            showTip('Token分片丢失字符，请检查内容', 'error');
        }
        return [chunk0, chunk1];
    }

    // ========== 5. 兼容暴力猴的Cookie设置 ==========
    async function setSessionCookies(chunk0, chunk1, expireTime) {
        // 先清理旧Cookie
        try {
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
        } catch (e) {
            console.warn('清理旧Cookie失败，继续写入：', e);
        }

        // 批量写入新Cookie
        const cookieList = [
            { name: "__Secure-next-auth.session-token0", value: chunk0 },
            { name: "__Secure-next-auth.session-token1", value: chunk1 }
        ];

        for (const item of cookieList) {
            try {
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
            } catch (err) {
                console.error(`写入Cookie ${item.name} 失败：`, err);
                // 降级尝试：去掉httpOnly再试一次
                try {
                    await GM_cookie.set({
                        name: item.name,
                        value: item.value,
                        domain: COOKIE_DOMAIN,
                        path: COOKIE_PATH,
                        secure: true,
                        sameSite: COOKIE_SAMESITE,
                        expiration: expireTime
                    });
                } catch (e2) {
                    throw new Error(`Cookie写入失败: ${item.name}`);
                }
            }
        }
    }

    // ========== 6. 主处理逻辑 ==========
    async function handleSessionInput(rawInput) {
        try {
            // 提取有效JSON
            const cleanText = rawInput.replace(/[\n\r\s]+/g, " ").match(/\{.*\}/)?.[0];
            if (!cleanText) throw new Error("未检测到合法JSON，请粘贴完整接口返回内容");

            const sessionData = JSON.parse(cleanText);
            const fullToken = sessionData.sessionToken;
            if (!fullToken) throw new Error("JSON中找不到sessionToken字段");

            const [c0, c1] = splitSessionToken(fullToken);
            const expireTs = Math.floor(new Date(sessionData.expires).getTime() / 1000);

            await setSessionCookies(c0, c1, expireTs);
            showTip('导入成功，3秒后自动刷新');
            setTimeout(() => window.location.reload(), 3000);
        } catch (err) {
            showTip('失败: ' + err.message, 'error');
            console.error("Session导入错误：", err);
        }
    }

    // ========== 初始化 ==========
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', createFloatButton);
    } else {
        createFloatButton();
    }
})();
