
import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { ComplianceData } from '../types';
import { Download, FileDown, Printer, ShieldCheck, RefreshCw, Share2, Check } from 'lucide-react';

interface LabelGeneratorProps {
  data: ComplianceData;
  image?: string;
  onRegenerate?: () => void;
}

const LabelGenerator: React.FC<LabelGeneratorProps> = ({ data, image, onRegenerate }) => {
  const [copied, setCopied] = useState(false);

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [100, 150],
    });

    doc.setLineWidth(0.5);
    doc.rect(5, 5, 90, 140);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPORT COMPLIANCE LABEL', 50, 15, { align: 'center' });
    doc.line(5, 20, 95, 20);

    doc.setFontSize(8);
    doc.text('SHIPPER ORIGIN:', 8, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(data.shippingLabelRequirements.origin || 'Certified Facility', 8, 33);

    doc.setFont('helvetica', 'bold');
    doc.text('TARGET MARKET:', 8, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.country} Import Zone`, 8, 50);

    doc.line(5, 55, 95, 55);

    doc.setFont('helvetica', 'bold');
    doc.text('ITEM DETAILS:', 8, 63);
    doc.setFont('helvetica', 'normal');
    doc.text(data.productName, 8, 68);
    doc.text(`Category: ${data.category}`, 8, 73);
    doc.text(`Harmonized Code: ${data.shippingLabelRequirements.hsCode}`, 8, 78);

    doc.line(5, 85, 95, 85);

    doc.setFont('helvetica', 'bold');
    doc.text('MANDATORY NOTICES:', 8, 93);
    doc.setFontSize(7);
    data.shippingLabelRequirements.warningLabels.forEach((label, i) => {
      doc.text(`- ${label}`, 12, 98 + i * 4);
    });

    doc.setFontSize(6);
    doc.text('VERIFIED BY GLOBALCOMPLIANCE AI', 50, 145, { align: 'center' });

    doc.save(`Compliance_Report_${data.productName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleShare = async () => {
    try {
      // Data to share
      const shareObj = {
        data,
        timestamp: Date.now(),
        // Only include image if it's reasonably sized, or just text data for stability
        image: (image && image.length < 500000) ? image : undefined 
      };

      const jsonStr = JSON.stringify(shareObj);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
      
      const shareUrl = `${window.location.origin}${window.location.pathname}#report=${encoded}`;
      
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Sharing failed:", err);
      alert("Failed to generate share link. The report data might be too large.");
    }
  };

  return (
    <div className="glass-card rounded-3xl p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <FileDown size={24} className="text-[#E2B859]" /> Export Document
        </h3>
        <div className="flex flex-wrap gap-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              title="Regenerate Analysis"
              className="flex items-center gap-2 bg-white/5 text-slate-300 px-4 py-2 rounded-xl font-bold text-xs transition-all hover:bg-white/10 hover:text-[#E2B859] border border-white/5"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
          )}
          <button
            onClick={handleShare}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${copied ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10 hover:text-[#E2B859]'}`}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            {copied ? 'Link Copied' : 'Share Report'}
          </button>
          <button
            onClick={generatePDF}
            className="flex items-center gap-2 bg-[#E2B859] text-[#0F1117] px-5 py-2 rounded-xl font-bold text-xs transition-all hover:scale-105"
          >
            <Download size={14} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="bg-white/5 p-6 rounded-2xl border border-white/5 relative group">
        <div className="bg-white text-slate-900 p-6 rounded-lg shadow-xl aspect-[1/1.4] max-w-[260px] mx-auto select-none no-mono">
          <div className="border border-slate-300 p-4 h-full flex flex-col gap-4 text-[10px]">
            <div className="text-center font-bold border-b border-slate-200 pb-2 mb-2 tracking-tight">
              OFFICIAL COMPLIANCE MANIFEST
            </div>
            
            <div>
              <div className="text-[8px] text-slate-400 font-bold mb-1">ORIGIN</div>
              <div className="font-semibold">{data.shippingLabelRequirements.origin}</div>
            </div>

            <div>
              <div className="text-[8px] text-slate-400 font-bold mb-1">DESTINATION</div>
              <div className="font-semibold">{data.country}</div>
            </div>

            <div className="border-y border-slate-100 py-3 my-1">
              <div className="flex justify-between font-semibold mb-1">
                <span>{data.productName}</span>
              </div>
              <div className="flex gap-4 text-[8px] text-slate-500 font-medium">
                <span>HS: {data.shippingLabelRequirements.hsCode}</span>
                <span>WT: {data.shippingLabelRequirements.weight || '7.5kg'}</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="text-[8px] text-slate-400 font-bold mb-2">NOTICES</div>
              {data.shippingLabelRequirements.warningLabels.map((w, i) => (
                <div key={i} className="flex gap-2 text-[9px] mb-1 font-medium text-slate-600">• {w}</div>
              ))}
            </div>

            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center">
              <div className="w-8 h-8 border border-slate-200 flex items-center justify-center text-[6px] font-bold">VERIFIED</div>
              <div className="h-4 w-20 bg-slate-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[10px] text-slate-500 text-center italic">
        Share links expire automatically after 7 days for security.
      </p>
    </div>
  );
};

export default LabelGenerator;
