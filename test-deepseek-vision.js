/**
 * 测试DeepSeek模型是否支持视觉识别
 */

import axios from 'axios';

const API_KEY = 'sk-517327aad3904959bc36f6decf453d7c';
const API_URL = 'https://api.deepseek.com';

async function testTextOnly() {
  console.log('\n========== 测试1: 纯文本分析 (当前项目使用的方式) ==========\n');

  const prompt = `分析以下按钮列表，找出"复制订阅链接"的按钮编号:

1. 文本: "复制订阅链接" | 选择器: button.copy-btn
2. 文本: "Clash一键订阅" | 选择器: a.clash-link
3. 文本: "导入到Shadowrocket" | 选择器: div.sr-import

返回JSON: {"buttonNumber": X, "confidence": 0.XX}`;

  try {
    const response = await axios.post(
      `${API_URL}/chat/completions`,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`
        }
      }
    );

    const result = response.data.choices[0].message.content;
    console.log('✅ 成功 - DeepSeek返回:');
    console.log(result);
    console.log('\n结论: deepseek-chat 可以分析文本结构并返回JSON\n');
  } catch (error) {
    console.error('❌ 失败:', error.response?.data || error.message);
  }
}

async function testImageInput() {
  console.log('\n========== 测试2: 尝试图像输入 (测试视觉能力) ==========\n');

  // 测试是否支持图像URL或base64
  const imagePrompt = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '描述这张图片中有什么按钮'
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://example.com/screenshot.png'
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(
      `${API_URL}/chat/completions`,
      imagePrompt,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`
        }
      }
    );

    console.log('✅ 意外成功 - DeepSeek支持视觉!');
    console.log(response.data.choices[0].message.content);
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('❌ 预期失败 - DeepSeek返回错误:');
      console.log(error.response.data);
      console.log('\n结论: deepseek-chat 不支持图像输入\n');
    } else {
      console.error('❌ 其他错误:', error.response?.data || error.message);
    }
  }
}

async function testVisionModel() {
  console.log('\n========== 测试3: 尝试deepseek-vl视觉模型 ==========\n');

  try {
    const response = await axios.post(
      `${API_URL}/chat/completions`,
      {
        model: 'deepseek-vl',  // 尝试视觉模型
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: '图片中有什么?' },
              {
                type: 'image_url',
                image_url: { url: 'https://picsum.photos/200/300' }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`
        }
      }
    );

    console.log('✅ 成功 - DeepSeek有视觉模型!');
    console.log(response.data.choices[0].message.content);
  } catch (error) {
    if (error.response?.status === 404 || error.response?.data?.error?.message?.includes('model')) {
      console.log('❌ 模型不存在 - DeepSeek错误:');
      console.log(error.response.data);
      console.log('\n结论: deepseek-vl 模型不存在或不可用\n');
    } else {
      console.error('❌ 其他错误:', error.response?.data || error.message);
    }
  }
}

async function listModels() {
  console.log('\n========== 测试4: 查询DeepSeek可用模型 ==========\n');

  try {
    const response = await axios.get(
      `${API_URL}/models`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`
        }
      }
    );

    console.log('✅ 可用模型列表:');
    response.data.data.forEach(model => {
      console.log(`  - ${model.id}`);
    });
  } catch (error) {
    console.log('❌ 无法获取模型列表:', error.response?.data || error.message);
  }
}

// 执行所有测试
(async () => {
  console.log('🧪 DeepSeek视觉能力测试\n');
  console.log('配置信息:');
  console.log(`  API URL: ${API_URL}`);
  console.log(`  API Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`  当前模型: deepseek-chat`);

  await testTextOnly();
  await testImageInput();
  await testVisionModel();
  await listModels();

  console.log('\n========== 测试完成 ==========\n');
})();
