// backend/services/ocrService.js - NEW FILE
// Install: npm install tesseract.js pdf-poppler

const Tesseract = require('tesseract.js');
const { convert } = require('pdf-poppler');
const fs = require('fs').promises;
const path = require('path');

class OCRService {
  constructor() {
    console.log('🔍 OCR Service initialized');
  }

  /**
   * Extract text from image using Tesseract OCR
   */
  async extractTextFromImage(imagePath) {
    try {
      console.log('🔍 Running OCR on image:', imagePath);

      const result = await Tesseract.recognize(
        imagePath,
        'eng', // Language: English
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
      throw error;
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
        page: null // All pages
      };

      await convert(pdfPath, options);

      // Get all generated image files
      const files = await fs.readdir(tempDir);
      const imageFiles = files
        .filter(f => f.endsWith('.png'))
        .sort(); // Ensure correct page order

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
      throw error;
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
      // Return whatever text we have
      return regularText || '';
    }
  }

  /**
   * Extract text from image file (JPG, PNG, etc.)
   */
  async extractFromImageFile(imagePath) {
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