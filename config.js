// 把下面两个值换成你自己 Supabase 项目的 (Project Settings -> API):
// SUPABASE_URL   例如 https://xxxxxxxx.supabase.co
// SUPABASE_ANON_KEY  "anon public" key (不是 service_role key!)
window.LEDGER_CONFIG = {
  SUPABASE_URL: "https://chgjswujuruteaiyyoxs.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZ2pzd3VqdXJ1dGVhaXl5b3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzk1MzgsImV4cCI6MjEwMzkxNTUzOH0.Z5TEY-tsQxM6GiJHzv2u0SQbRgxV9pD2N0FuK-H-m80",
  PHOTO_BUCKET: "ledger-photos",
  BUSINESS_NAME: "XING YANG FOOD PRODUCTS SDN BHD", // 显示在导出 PDF 报告抬头,改成你自己的店名/公司名
  // 三个密码,自己改成你想要的数字。员工密码只能看"记录"页,看不到成本/库存/设置,
  // 也不能删除记录;老板和经理密码权限完全一样,能看全部功能、也能删除记录。
  // 注意:这只是界面层面的隐藏,不是真安全 —— 密码就写在这个文件里,懂技术的人
  // 打开浏览器开发者工具或直接调用 API 仍能看到数据。想要真正的权限控制需要接入
  // Supabase 的登录系统,目前这版还没做。
  PINS: {
    boss: "4161",
    manager: "3420",
    staff: "0000"
  }
};
