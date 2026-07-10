// ==UserScript==
// @name         ChatGPT Session导入(暴力猴调试版)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Kiwi+暴力猴兼容版，带完整调试日志
// @author       You
// @match        https://chatgpt.com/*
// @grant        GM_cookie
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    console.log('✅ Session导入脚本已成功注入页面');
    
    const SPLIT_MAX = 4000;
    const COOKIE_DOMAIN = "chatgpt.com"; // 暴力猴兼容：去掉前导点
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "lax";

    // 创建悬浮按钮
    function createFloatButton() {
        if(document.getElementById('gptSessionImportBtn')) return;
        const floatBtn = document.createElement('button');
        floatBtn.id = 'gptSessionImportBtn';
        floatBtn.innerText = '导入Session';
        Object.assign(floatBtn.style, {
            position: 'fixed', top: '80px', right: '16px', zIndex: '999999',
            padding: '12px 16px', background: '#10a37f', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        });
        document.body.appendChild(floatBtn);
        floatBtn.addEventListener('click', showInputModal);
        console.log('✅ 导入按钮已渲染到页面');
    }

    // 自定义长文本输入弹窗
    function showInputModal() {
        const mask = document.createElement('div');
        mask.id = 'sessionImportMask';
        Object.assign(mask.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: '9999999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', boxSizing: 'border-box'
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            background: '#fff', borderRadius: '10px', width: '100%',
            maxWidth: '500px', padding: '20px', boxSizing: 'border-box'
        });

        const title = document.createElement('h3');
        title.innerText = '粘贴Session完整JSON';
        title.style.margin = '0 0 12px 0';

        const textarea = document.createElement('textarea');
        textarea.placeholder = '粘贴 /api/auth/session 返回的全部内容';
        Object.assign(textarea.style, {
            width: '100%', height: '180px', padding: '10px',
            border: '1px solid #ddd', borderRadius: '6px',
            fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px'
        });

        const btnWrap = document.createElement('div');
        Object.assign(btnWrap.style, {
            display: 'flex', gap: '10px', justifyContent: 'flex-end'
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.innerText = '取消';
        Object.assign(cancelBtn.style, {
            padding: '8px 16px', border: '1px solid #ddd',
            background: '#f5f5f5', borderRadius: '6px'
        });
        cancelBtn.onclick = () => document.body.removeChild(mask);

        const confirmBtn = document.createElement('button');
        confirmBtn.innerText = '确认导入';
        Object.assign(confirmBtn.style, {
            padding: '8px 16px', border: 'none',
            background: '#10a37f', color: '#fff', borderRadius: '6px'
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

    // 页面内轻提示
    function showTip(text, type = 'success') {
        const tip = document.createElement('div');
        tip.innerText = text;
        const bgColor = type === 'error' ? '#e53935' : '#10a37f';
        Object.assign(tip.style, {
            position: 'fixed', top: '40%', left: '50%',
            transform: 'translateX(-50%)', background: bgColor,
            color: '#fff', padding: '12px 20px', borderRadius: '8px',
            zIndex: '10000000', fontSize: '14px'
        });
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), 2500);
    }

    // Token拆分+校验
    function splitSessionToken(fullStr) {
        const chunk0 = fullStr.slice(0, SPLIT_MAX);
        const chunk1 = fullStr.slice(SPLIT_MAX);
        console.log('📌 Token拆分完成：第一段长度=' + chunk0.length + ', 第二段长度=' + chunk1.length);
        return [chunk0, chunk1];
    }

    // 写入Cookie（暴力猴兼容：优先带HttpOnly，失败自动降级）
    async function setSessionCookies(chunk0, chunk1) {
        // 先清理旧Cookie
        try {
            await GM_cookie.delete({name:"__Secure-next-auth.session-token0", domain:COOKIE_DOMAIN, path:COOKIE_PATH});
            await GM_cookie.delete({name:"__Secure-next-auth.session-token1", domain:COOKIE_DOMAIN, path:COOKIE_PATH});
            console.log('✅ 旧Cookie清理完成');
        } catch (e) {
            console.warn('⚠️ 清理旧Cookie失败，继续写入：', e);
        }

        const cookieList = [
            { name: "__Secure-next-auth.session-token0", value: chunk0 },
            { name: "__Secure-next-auth.session-token1", value: chunk1 }
        ];

        for (const item of cookieList) {
            let writeSuccess = false;
            
            // 第一次尝试：带HttpOnly
            try {
                await GM_cookie.set({
                    name: item.name,
                    value: item.value,
                    domain: COOKIE_DOMAIN,
                    path: COOKIE_PATH,
                    secure: true,
                    sameSite: COOKIE_SAMESITE,
                    httpOnly: true
                });
                writeSuccess = true;
                console.log(`✅ ${item.name} 写入成功（带HttpOnly）`);
            } catch (err) {
                console.warn(`⚠️ ${item.name} 带HttpOnly写入失败，尝试降级：`, err);
            }

            // 降级尝试：不带HttpOnly
            if (!writeSuccess) {
                try {
                    await GM_cookie.set({
                        name: item.name,
                        value: item.value,
                        domain: COOKIE_DOMAIN,
                        path: COOKIE_PATH,
                        secure: true,
                        sameSite: COOKIE_SAMESITE
                    });
                    console.log(`✅ ${item.name} 写入成功（降级无HttpOnly）`);
                } catch (err2) {
                    console.error(`❌ ${item.name} 最终写入失败：`, err2);
                    throw new Error(`Cookie写入失败: ${item.name}`);
                }
            }
        }
    }

    // 主处理逻辑
    async function handleSessionInput(rawInput) {
        try {
            console.log('📥 接收到输入内容，原始长度：', rawInput.length);
            
            // 提取有效JSON
            const cleanText = rawInput.replace(/[\n\r\s]+/g, " ").match(/\{.*\}/)?.[0];
            if (!cleanText) throw new Error("未检测到合法JSON格式");
            console.log('✅ JSON提取成功，有效长度：', cleanText.length);

            const sessionData = JSON.parse(cleanText);
            const fullToken = sessionData.sessionToken;
            if (!fullToken) throw new Error("JSON中未找到sessionToken字段");
            console.log('✅ 成功提取sessionToken，总长度：', fullToken.length);

            const [c0, c1] = splitSessionToken(fullToken);
            await setSessionCookies(c0, c1);
            
            showTip('导入成功，3秒后自动刷新');
            console.log('✅ 全部流程完成，准备刷新页面');
            setTimeout(() => window.location.reload(), 3000);
        } catch (err) {
            showTip('失败: ' + err.message, 'error');
            console.error('❌ 导入流程失败：', err);
        }
    }

    // 初始化
    if (document.readyState === "loading") {
        document.addEventListener('DOMContentLoaded', createFloatButton);
    } else {
        createFloatButton();
    }
})();
