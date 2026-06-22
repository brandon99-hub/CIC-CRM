import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, Building2, DollarSign } from 'lucide-react';

interface LostReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  projectName: string;
  projectRevenue?: string | number;
  isSubmitting?: boolean;
  initialReason?: string;
}

export function LostReasonModal({
  isOpen,
  onClose,
  onSubmit,
  projectName,
  projectRevenue,
  isSubmitting = false,
  initialReason = ''
}: LostReasonModalProps) {
  const [reason, setReason] = useState(initialReason);
  const [error, setError] = useState('');

  // Update reason when initialReason changes
  useEffect(() => {
    setReason(initialReason);
  }, [initialReason]);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('Lost reason is required');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Lost reason must be at least 10 characters long');
      return;
    }

    setError('');
    onSubmit(reason.trim());
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-[#e55f00] rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Mark Project as Lost
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Please provide a detailed reason for why this project was lost
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Project Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-[#004E98]" />
                <span>Project Information</span>
              </h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 flex items-center space-x-1 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Organization</span>
                </Label>
                <div className="h-11 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium flex items-center">
                  {projectName}
                </div>
              </div>
              
              {projectRevenue && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 flex items-center space-x-1 mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span>Revenue Value</span>
                  </Label>
                  <div className="h-11 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 font-medium flex items-center">
                    {formatCurrency(projectRevenue)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lost Reason Form */}
          <div className="bg-red-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2 pb-2 border-b border-red-200">
              <div className="w-1 h-6 bg-red-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Loss Details</span>
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lostReason" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Reason for Loss</span>
                  <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="lostReason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError('');
                  }}
                  placeholder="Explain in detail why this project was lost. Include factors like budget issues, timing, competitor advantage, decision maker changes, etc."
                  className="min-h-[120px] border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 rounded-lg transition-all duration-200 resize-none"
                  maxLength={500}
                />
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className={error ? 'text-red-500 flex items-center gap-1' : ''}>
                    {error && <span className="w-1 h-1 bg-red-500 rounded-full"></span>}
                    {error}
                  </span>
                  <span>{reason.length}/500 characters</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Box */}
          <div className="bg-[#e55f00]/5 border border-[#e55f00]/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-[#e55f00] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-3 h-3 text-white" />
              </div>
              <div className="text-sm text-[#e55f00]">
                <p className="font-medium mb-1">Important Note</p>
                <p className="text-[#e55f00]">
                  Once marked as lost, this project will be moved to the lost projects section. 
                  You can still revive it later if the situation changes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-6 border-t border-gray-200">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="flex-1 h-11 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim() || reason.trim().length < 10}
            className="flex-1 h-11 bg-gradient-to-r from-red-600 to-[#e55f00] hover:from-red-700 hover:to-[#c44700] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Marking as Lost...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Mark as Lost
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
