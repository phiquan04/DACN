import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Đăng ký | Manabi AI"
        description="Tạo tài khoản Manabi AI để bắt đầu hành trình chinh phục tiếng Nhật."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
