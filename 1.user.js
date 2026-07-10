// ==UserScript==
// @name         ChatGPT Session导入(原生Cookie兜底版)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Kiwi+暴力猴终极兼容版，原生JS写入Cookie，无权限依赖
// @author       You
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    console.log('✅ Session导入脚本已成功注入页面');
    
    const SPLIT_MAX = 4000;
    const COOKIE_DOMAIN = ".chatgpt.com";
    const COOKIE_PATH = "/";
    const COOKIE_SAMESITE = "Lax";

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

    // 自定义长文本输入弹窗（解决手机端输入字数限制）
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

    // ========== 原生JS写入Cookie（核心兜底，完全不依赖GM API）==========
    function setSessionCookies(chunk0, chunk1) {
        // 先删除旧Cookie（参数必须和写入时完全一致才能成功删除）
        const expirePast = "expires=Thu, 01 Jan 1970 00:00:00 UTC";
        const baseAttr = `domain=${COOKIE_DOMAIN}; path=${COOKIE_PATH}; secure; SameSite=${COOKIE_SAMESITE}`;
        
        document.cookie = `__Secure-next-auth.session-token0=; ${expirePast}; ${baseAttr}`;
        document.cookie = `__Secure-next-auth.session-token1=; ${expirePast}; ${baseAttr}`;
        console.log('✅ 旧Cookie已清理');

        // 写入新的分片Cookie
        document.cookie = `__Secure-next-auth.session-token0=${chunk0}; ${baseAttr}`;
        document.cookie = `__Secure-next-auth.session-token1=${chunk1}; ${baseAttr}`;
        console.log('✅ 原生Cookie写入完成');
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
            setSessionCookies(c0, c1);
            
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
