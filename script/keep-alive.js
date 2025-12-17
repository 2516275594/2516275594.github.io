const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

async function keepAlive() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 方法1: 执行简单查询
    console.log('执行简单查询...');
    const { data, error } = await supabase
      .from('users')  // 替换为你的表名
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('查询失败，尝试其他方法:', error.message);
      
      // 方法2: 调用存储过程（如果存在）
      const { error: rpcError } = await supabase
        .rpc('get_server_timestamp');
      
      if (rpcError) {
        console.log('RPC调用失败，尝试直接插入:', rpcError.message);
        
        // 方法3: 插入测试数据（确保有对应的表）
        const { error: insertError } = await supabase
          .from('keep_alive')  // 需要先创建这个表
          .insert({ ping: new Date().toISOString() });
          
        if (insertError) {
          console.log('插入失败:', insertError.message);
        } else {
          console.log('插入成功，数据库已激活');
        }
      } else {
        console.log('RPC调用成功，数据库已激活');
      }
    } else {
      console.log('查询成功，数据库已激活');
    }
    
  } catch (error) {
    console.error('所有方法都失败了:', error);
  }
}

keepAlive();
