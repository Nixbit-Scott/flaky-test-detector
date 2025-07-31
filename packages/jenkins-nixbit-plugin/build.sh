#!/bin/bash

# Nixbit Jenkins Plugin Build Script
# Builds and packages the Jenkins plugin for distribution

set -e

echo "🔨 Building Nixbit Jenkins Plugin..."

# Check if Maven is available
if ! command -v mvn &> /dev/null; then
    echo "❌ Maven is required but not installed. Please install Maven first."
    exit 1
fi

# Check Java version
java_version=$(java -version 2>&1 | grep -oP 'version "?(1\.)?\K\d+' | head -1)
if [ "$java_version" -lt 11 ]; then
    echo "❌ Java 11 or higher is required. Current version: Java $java_version"
    exit 1
fi

echo "✅ Using Java $java_version"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
mvn clean

# Compile and package
echo "📦 Compiling and packaging plugin..."
mvn package -DskipTests

# Check if build was successful
if [ -f target/*.hpi ]; then
    plugin_file=$(ls target/*.hpi)
    plugin_size=$(du -h "$plugin_file" | cut -f1)
    
    echo "✅ Plugin built successfully!"
    echo "📁 Plugin file: $plugin_file"
    echo "📏 Size: $plugin_size"
    echo ""
    echo "🚀 Installation options:"
    echo "  1. Upload via Jenkins UI: Manage Jenkins → Manage Plugins → Advanced → Upload Plugin"
    echo "  2. Copy to plugins directory: cp $plugin_file \$JENKINS_HOME/plugins/"
    echo "  3. Use Jenkins CLI: java -jar jenkins-cli.jar install-plugin $plugin_file"
    echo ""
    echo "📚 Documentation: https://docs.nixbit.dev/jenkins"
    echo "🆘 Support: https://nixbit.dev/support"
else
    echo "❌ Build failed - no .hpi file generated"
    exit 1
fi

# Optional: Run tests if requested
if [ "$1" = "--with-tests" ]; then
    echo ""
    echo "🧪 Running tests..."
    mvn test
    
    if [ $? -eq 0 ]; then
        echo "✅ All tests passed!"
    else
        echo "❌ Some tests failed"
        exit 1
    fi
fi

# Optional: Start development Jenkins instance
if [ "$1" = "--dev" ]; then
    echo ""
    echo "🚀 Starting development Jenkins instance..."
    echo "   Jenkins will be available at: http://localhost:8080/jenkins"
    echo "   Plugin will be pre-installed and ready for testing"
    echo "   Press Ctrl+C to stop the development server"
    echo ""
    mvn hpi:run
fi

echo ""
echo "🎉 Build completed successfully!"