import { LoginForm } from "../../components/auth/login-form";
import { MobileShell } from "../../components/layout/mobile-shell";
import { PageHeader } from "../../components/layout/page-header";

export default function LoginPage() {
  return (
    <MobileShell>
      <PageHeader title="登录" description="验证码 + 学号密码，成功后保持 30 天" />
      <LoginForm />
    </MobileShell>
  );
}
