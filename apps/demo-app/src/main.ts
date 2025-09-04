import { busApi } from 'request-bus'

/**
 * @description 演示应用主函数
 */
async function main() {
  console.log('=== 开始演示请求库功能 ===\n')

  try {
    // 1. 演示用户 API
    console.log('--- 1. 获取用户信息（带重试） ---')
    const user = await busApi.user.getUserInfo('1')
    console.log('用户信息:', user)
    console.log()

    // 2. 演示缓存功能
    console.log('--- 2. 获取用户列表（带缓存） ---')
    const users1 = await busApi.user.getUserList()
    console.log(`首次获取用户列表，数量: ${users1.length}`)
    
    const users2 = await busApi.user.getUserList()
    console.log(`再次获取用户列表（应该命中缓存），数量: ${users2.length}`)
    console.log()

    // 3. 演示文章 API
    console.log('--- 3. 获取文章列表 ---')
    const posts = await busApi.post.getPosts(1)
    console.log(`用户1的文章数量: ${posts.length}`)
    console.log('第一篇文章标题:', posts[0]?.title)
    console.log()

    // 4. 演示单篇文章获取
    console.log('--- 4. 获取单篇文章 ---')
    const post = await busApi.post.getPost(1)
    console.log('文章详情:', {
      id: post.id,
      title: post.title,
      body: post.body.substring(0, 50) + '...'
    })
    console.log()

    // 5. 演示切换实现
    console.log('--- 5. 切换到 Fetch 实现 ---')
    busApi.switchImplementation('fetch')
    
    const userWithFetch = await busApi.user.getUserInfo('2')
    console.log('使用 Fetch 获取用户信息:', userWithFetch)
    console.log()

    // 6. 演示创建文章
    console.log('--- 6. 创建新文章 ---')
    const newPost = await busApi.post.createPost({
      userId: 1,
      title: '测试文章标题',
      body: '这是一篇测试文章的内容'
    })
    console.log('创建的文章:', newPost)
    console.log()

    console.log('=== 所有功能演示完成 ===')

  } catch (error) {
    console.error('=== 演示过程中发生错误 ===')
    console.error('错误详情:', error)
  }
}

/**
 * @description 演示错误处理和重试机制
 */
async function demoErrorHandling() {
  console.log('\n=== 演示错误处理和重试机制 ===')
  
  try {
    // 尝试访问不存在的用户
    await busApi.user.getUserInfo('999999')
  } catch (error) {
    console.log('捕获到预期的错误:', error instanceof Error ? error.message : error)
  }
}

// 运行演示
main().then(() => {
  return demoErrorHandling()
}).then(() => {
  console.log('\n演示程序结束')
}).catch((error) => {
  console.error('程序运行失败:', error)
})
