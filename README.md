# Photo to 3D - AI-Powered 3D Model Generator

Convert your photos into stunning 3D models using advanced AI technology. This web application leverages Stability AI's SF3D (Stable Fast 3D) for professional-quality 3D reconstruction with automatic background removal.

## ✨ Features

- **Multi-Photo 3D Reconstruction**: Upload 5-8 photos to generate high-quality 3D models
- **AI Background Removal**: Automatic background removal using Stability AI
- **Multiple Export Formats**: Download your 3D models in GLB, OBJ, FBX, and STL formats
- **Real-time Processing**: Track your model generation progress with live status updates
- **User Authentication**: Secure login system with NextAuth.js
- **Project Management**: Organize your 3D models into projects
- **Cloud Storage**: Azure Blob Storage integration for reliable file management
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🚀 Technology Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Authentication**: NextAuth.js with credentials provider
- **Database**: SQLite with Prisma ORM
- **AI Processing**: Stability AI SF3D API
- **File Storage**: Azure Blob Storage
- **3D Processing**: Stability AI background removal + 3D reconstruction
- **UI Components**: Custom React components with modern design

## 📋 Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Stability AI API key
- Azure Storage account (optional, falls back to mock mode)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd photo-to-3d
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure your `.env.local` file**
   ```env
   # NextAuth Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-super-secret-nextauth-key-for-development

   # Database
   DATABASE_URL="file:./prisma/dev.db"

   # Stability AI API (Required for real 3D processing)
   STABILITY_API_KEY=your-stability-ai-api-key

   # Azure Blob Storage (Optional - falls back to mock mode)
   AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
   AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
   AZURE_STORAGE_CONTAINER_NAME=photo-to-3d-uploads
   ```

5. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Stability AI Setup

1. Get your API key from [Stability AI Platform](https://platform.stability.ai/)
2. Add the key to your `.env.local` file
3. The app uses SF3D (2 credits per generation) for 3D reconstruction

### Azure Storage Setup (Optional)

1. Create an Azure Storage account
2. Create a blob container for uploads
3. Get your account name and key from Azure portal
4. Add credentials to `.env.local`

**Note**: If Azure is not configured, the app automatically falls back to mock mode for development.

## 🎯 How It Works

### Processing Pipeline

1. **Photo Upload**: Users upload 5-8 photos of an object from different angles
2. **Background Removal**: Each photo has its background automatically removed using Stability AI
3. **3D Reconstruction**: All background-removed photos are processed to generate a single 3D model
4. **Format Conversion**: The model is made available in multiple formats (GLB, OBJ, FBX, STL)

### Supported Input
- **Photo Count**: 5-8 images required
- **File Formats**: JPEG, PNG, WebP
- **File Size**: Up to 10MB per image
- **Recommended**: Multiple angles, good lighting, clear subject

### Output Formats
- **GLB**: Primary format with textures
- **OBJ**: Geometry only, widely compatible
- **FBX**: Autodesk format for animation
- **STL**: For 3D printing

## 📖 Usage

1. **Create Account**: Sign up or sign in to your account
2. **New Project**: Click "New Project" from the dashboard
3. **Upload Photos**: Drag and drop or select 5-8 photos
4. **Start Processing**: Submit to begin AI processing
5. **Monitor Progress**: Watch real-time status updates
6. **Download Models**: Access your completed 3D models in various formats

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   ├── models/            # 3D model viewer
│   └── upload/            # Photo upload interface
├── components/            # React components
│   ├── auth/              # Authentication components
│   ├── upload/            # Upload components
│   └── ui/                # UI components
├── lib/                   # Utility libraries
│   ├── auth.ts            # NextAuth configuration
│   ├── azure-storage.ts   # Azure Blob Storage client
│   ├── prisma.ts          # Database client
│   └── stability.ts       # Stability AI integration
└── prisma/                # Database schema and migrations
```

## 🔒 Security Features

- User authentication with secure sessions
- File type and size validation
- API rate limiting
- Secure file upload handling
- Environment variable protection
- Database query protection with Prisma

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on every push

### Other Platforms

The app can be deployed on any platform that supports Node.js applications:
- Railway
- Heroku
- AWS App Runner
- Google Cloud Run

## 🐛 Troubleshooting

### Common Issues

**"Processing stuck on pending"**
- Check if Stability AI API key is configured
- Verify network connectivity
- Check browser console for errors

**"Upload failed"**
- Ensure photos are 5-8 in count
- Check file sizes (max 10MB each)
- Verify file formats (JPEG, PNG, WebP only)

**"Database connection error"**
- Run `npx prisma generate`
- Ensure database file permissions
- Check DATABASE_URL in .env.local

### Development Mode

The app includes comprehensive mock modes:
- Mock 3D processing when Stability AI not configured
- Mock file storage when Azure not configured
- Realistic processing times and success/failure rates

## 📊 API Usage

### Stability AI Costs
- SF3D: 2 credits per 3D generation
- Background Removal: 1 credit per image
- Total per project: ~6-9 credits (depending on photo count)

### Rate Limits
- 2-second delay between API calls
- Automatic retry on failure
- Progress tracking and error handling

## 🤝 Contributing

This is a private repository. For internal development:

1. Create feature branches from main
2. Follow TypeScript and ESLint rules
3. Test thoroughly before merging
4. Update documentation as needed

## 📝 License

Private repository - All rights reserved.

## 🆘 Support

For technical support or questions:
- Check the troubleshooting section above
- Review error logs in browser console
- Contact the development team

## 🔄 Version History

### v1.0.0 (Current)
- Initial release with full 3D processing pipeline
- Stability AI SF3D integration
- Azure Blob Storage support
- Complete authentication system
- Multi-format export capabilities
