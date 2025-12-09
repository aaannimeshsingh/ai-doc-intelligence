// backend/services/ocrService.js
const fs = require('fs').promises;
const path = require('path');

// Try to load OCR dependencies - may fail on some platforms
let Tesseract;
let convert;
let isOCRAvailable = false;

try {
  // Check if platform supports OCR (Tesseract has issues on some Linux systems)
  if (process.platform === 'linux') {
    console.log('⚠️ OCR disabled on Linux platform (Render/deployment compatibility)');
    isOCRAvailable = false;
  } else {
    Tesseract = require('tesseract.js');
    const pdfPoppler = require('pdf-poppler');
    convert = pdfPoppler.convert;
    isOCRAvailable = true;
    console.log('🔍 OCR Service initialized');
  }
} catch (error) {
  console.log('⚠️ OCR dependencies not available:', error.message);
  isOCRAvailable = false;
}

class OCRService {
  constructor() {
    this.isAvailable = isOCRAvailable;
    if (!isOCRAvailable) {
      console.log('⚠️ OCR Service running in limited mode (text-only PDFs)');
    }
  }

  /**
   * Extract text from image using Tesseract OCR
   */
  async extractTextFromImage(imagePath) {
    if (!isOCRAvailable) {
      console.log('⚠️ OCR not available on this platform');
      return { text: '', confidence: 0 };
    }

    try {
      console.log('🔍 Running OCR on image:', imagePath);

      const result = await Tesseract.recognize(
        imagePath,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      console.log('✅ OCR completed, confidence:', result.data.confidence);
      return {
        text: result.data.text,
        confidence: result.data.confidence
      };

    } catch (error) {
      console.error('❌ OCR error:', error);
      return { text: '', confidence: 0 };
    }
  }

  /**
   * Check if PDF is scanned (image-based) by trying to extract text
   */
  async isScannedPDF(pdfPath, extractedText) {
    // If extracted text is very short or empty, likely scanned
    if (!extractedText || extractedText.trim().length < 50) {
      console.log('⚠️ PDF appears to be scanned (little/no text)');
      return true;
    }

    // Check text-to-file-size ratio
    const stats = await fs.stat(pdfPath);
    const fileSizeKB = stats.size / 1024;
    const textLength = extractedText.length;
    const ratio = textLength / fileSizeKB;

    // Low ratio suggests image-based PDF
    if (ratio < 10) {
      console.log('⚠️ PDF appears to be scanned (low text/size ratio)');
      return true;
    }

    console.log('✅ PDF contains readable text');
    return false;
  }

  /**
   * Convert PDF to images and run OCR on each page
   */
  async extractTextFromScannedPDF(pdfPath) {
    if (!isOCRAvailable) {
      console.log('⚠️ OCR not available - cannot process scanned PDF');
      return { text: '', pages: [], averageConfidence: 0 };
    }

    try {
      console.log('📄 Converting scanned PDF to images...');

      // Create temp directory for images
      const tempDir = path.join(__dirname, '../temp', Date.now().toString());
      await fs.mkdir(tempDir, { recursive: true });

      // Convert PDF to images (one per page)
      const options = {
        format: 'png',
        out_dir: tempDir,
        out_prefix: 'page',
        page: null
      };

      await convert(pdfPath, options);

      // Get all generated image files
      const files = await fs.readdir(tempDir);
      const imageFiles = files
        .filter(f => f.endsWith('.png'))
        .sort();

      console.log(`✅ Generated ${imageFiles.length} page images`);

      // Run OCR on each page
      let fullText = '';
      const pageResults = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = path.join(tempDir, imageFiles[i]);
        console.log(`🔍 OCR on page ${i + 1}/${imageFiles.length}...`);

        const result = await this.extractTextFromImage(imagePath);
        
        fullText += `\n\n--- Page ${i + 1} ---\n\n${result.text}`;
        
        pageResults.push({
          page: i + 1,
          text: result.text,
          confidence: result.confidence
        });
      }

      // Cleanup: Delete temp images
      for (const file of imageFiles) {
        await fs.unlink(path.join(tempDir, file)).catch(() => {});
      }
      await fs.rmdir(tempDir).catch(() => {});

      const avgConfidence = pageResults.reduce((sum, p) => sum + p.confidence, 0) / pageResults.length;

      console.log('✅ OCR completed for all pages');
      console.log(`📊 Average confidence: ${avgConfidence.toFixed(2)}%`);

      return {
        text: fullText.trim(),
        pages: pageResults,
        averageConfidence: avgConfidence
      };

    } catch (error) {
      console.error('❌ Scanned PDF OCR error:', error);
      return { text: '', pages: [], averageConfidence: 0 };
    }
  }

  /**
   * Smart text extraction: Try regular extraction first, then OCR if needed
   */
  async smartExtractText(filePath, mimetype, regularText) {
    try {
      // Only process PDFs
      if (mimetype !== 'application/pdf') {
        return regularText;
      }

      // Check if PDF needs OCR
      const isScanned = await this.isScannedPDF(filePath, regularText);

      if (!isScanned) {
        console.log('✅ Using regular text extraction');
        return regularText;
      }

      if (!isOCRAvailable) {
        console.log('⚠️ PDF appears to be scanned, but OCR is not available on this platform');
        console.log('📝 Returning extracted text (may be incomplete)');
        return regularText || '';
      }

      // Run OCR for scanned PDF
      console.log('🔍 Running OCR on scanned PDF...');
      const ocrResult = await this.extractTextFromScannedPDF(filePath);

      // Combine regular text (if any) with OCR text
      const combinedText = [
        regularText?.trim(),
        ocrResult.text
      ].filter(Boolean).join('\n\n');

      return combinedText;

    } catch (error) {
      console.error('❌ Smart extraction error:', error);
      return regularText || '';
    }
  }

  /**
   * Extract text from image file (JPG, PNG, etc.)
   */
  async extractFromImageFile(imagePath) {
    if (!isOCRAvailable) {
      console.log('⚠️ OCR not available - cannot extract from image');
      return '';
    }

    try {
      const result = await this.extractTextFromImage(imagePath);
      return result.text;
    } catch (error) {
      console.error('❌ Image extraction error:', error);
      return '';
    }
  }
}

module.exports = new OCRService();