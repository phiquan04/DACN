import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Đăng nhập | Manabi AI"
        description="Đăng nhập vào Manabi AI để tiếp tục hành trình học tiếng Nhật của bạn."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
