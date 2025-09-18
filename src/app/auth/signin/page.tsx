import SignInForm from '@/components/auth/SignInForm'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Photo to 3D
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Create 3D models from your photos
        </p>
      </div>
      <SignInForm />
    </div>
  )
}