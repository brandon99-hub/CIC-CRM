import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Users, DollarSign, Mail, Percent } from "lucide-react";

interface ExistingProspect {
  id: string;
  client: string;
  date: string;
  stage: string;
  revenue?: number;
  bdName: string;
  bdEmail: string;
}

interface RevenueSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  onConfirm: (splitData: RevenueSplitData) => void;
  existingProspect: ExistingProspect | null;
  newMarketer: {
    id: string;
    name: string;
    email: string;
  };
}

interface RevenueSplitData {
  originalMarketerId: string;
  newMarketerId: string;
  originalPercentage: number;
  newPercentage: number;
  totalRevenue: number;
}

export function RevenueSharingModal({
  isOpen,
  onClose,
  onBack,
  onConfirm,
  existingProspect,
  newMarketer
}: RevenueSharingModalProps) {
  const [originalPercentage, setOriginalPercentage] = useState(50);
  const [newPercentage, setNewPercentage] = useState(50);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(false);

  // Auto-fill revenue when modal opens
  useEffect(() => {
    if (existingProspect && isOpen) {
      // If the original prospect has revenue, use it; otherwise start with 0
      const existingRevenue = existingProspect.revenue || 0;
      setTotalRevenue(existingRevenue);
    }
  }, [existingProspect, isOpen]);

  const handleSubmit = async () => {
    if (!existingProspect) return;

    // Validate percentages
    if (originalPercentage + newPercentage !== 100) {
      alert("Percentages must add up to 100%");
      return;
    }

    setLoading(true);
    try {
      const splitData: RevenueSplitData = {
        originalMarketerId: existingProspect.id, // This should be the original marketer's ID
        newMarketerId: newMarketer.id,
        originalPercentage,
        newPercentage,
        totalRevenue
      };

      await onConfirm(splitData);
      onClose();
    } catch (error) {
      console.error("Error processing revenue split:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOriginalPercentageChange = (value: string) => {
    const percentage = parseInt(value);
    setOriginalPercentage(percentage);
    setNewPercentage(100 - percentage);
  };

  const handleNewPercentageChange = (value: string) => {
    const percentage = parseInt(value);
    setNewPercentage(percentage);
    setOriginalPercentage(100 - percentage);
  };

  if (!existingProspect) return null;

  const percentageOptions = [
    { value: "0", label: "0%" },
    { value: "10", label: "10%" },
    { value: "20", label: "20%" },
    { value: "25", label: "25%" },
    { value: "30", label: "30%" },
    { value: "40", label: "40%" },
    { value: "50", label: "50%" },
    { value: "60", label: "60%" },
    { value: "70", label: "70%" },
    { value: "75", label: "75%" },
    { value: "80", label: "80%" },
    { value: "90", label: "90%" },
    { value: "100", label: "100%" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border-2 border-[#e55f00]/20 shadow-2xl bg-white">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#e55f00]/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-[#e55f00]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Prospect Already Exists
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                This prospect is already being managed by another marketer. Set up revenue sharing.
                <br />
                <span className="text-sm text-[#004E98] mt-1 block">
                  💾 Your form data has been saved and will be restored if you go back.
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Prospect Info */}
          <Card className="border-[#e55f00]/20 bg-[#e55f00]/5">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-4 w-4 text-[#e55f00]" />
                <h3 className="font-medium text-[#e55f00]">Existing Prospect Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Client:</span>
                  <span className="ml-2 text-gray-900">{existingProspect.client}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Current Stage:</span>
                  <span className="ml-2 text-gray-900">{existingProspect.stage}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Original Marketer:</span>
                  <span className="ml-2 text-gray-900">{existingProspect.bdName}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="ml-2 text-gray-900">{existingProspect.bdEmail}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* New Marketer Info */}
          <Card className="border-[#004E98]/20 bg-[#004E98]/5">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-4 w-4 text-[#004E98]" />
                <h3 className="font-medium text-[#004E98]">New Marketer</h3>
              </div>
              <div className="text-sm">
                <div>
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-2 text-gray-900">{newMarketer.name}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <span className="ml-2 text-gray-900">{newMarketer.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-6 bg-[#01a64e] rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Revenue Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalRevenue" className="text-sm font-medium text-gray-700 flex items-center">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Total Revenue <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="totalRevenue"
                  type="number"
                  value={totalRevenue}
                  onChange={(e) => setTotalRevenue(parseFloat(e.target.value) || 0)}
                  placeholder="Enter total revenue"
                  className="h-11"
                />
                {existingProspect?.revenue && (
                  <p className="text-xs text-[#004E98]">
                    Auto-filled from original prospect: ${existingProspect.revenue}
                  </p>
                )}
                {!existingProspect?.revenue && (
                  <p className="text-xs text-gray-500">
                    No existing revenue - enter new amount
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Revenue Split */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-6 bg-[#004E98] rounded-full"></div>
              <h3 className="text-lg font-semibold text-gray-900">Revenue Split</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Marketer Split */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center">
                  <Percent className="h-4 w-4 mr-1" />
                  {existingProspect.bdName} Percentage
                </Label>
                <Select value={originalPercentage.toString()} onValueChange={handleOriginalPercentageChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select percentage" />
                  </SelectTrigger>
                  <SelectContent>
                    {percentageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-gray-600">
                  Revenue: ${((totalRevenue * originalPercentage) / 100).toFixed(2)}
                </div>
              </div>

              {/* New Marketer Split */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 flex items-center">
                  <Percent className="h-4 w-4 mr-1" />
                  {newMarketer.name} Percentage
                </Label>
                <Select value={newPercentage.toString()} onValueChange={handleNewPercentageChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select percentage" />
                  </SelectTrigger>
                  <SelectContent>
                    {percentageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-gray-600">
                  Revenue: ${((totalRevenue * newPercentage) / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Total Validation */}
            <div className={`p-3 rounded-lg ${originalPercentage + newPercentage === 100 ? 'bg-[#01a64e]/5 border border-[#01a64e]/20' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${originalPercentage + newPercentage === 100 ? 'bg-[#01a64e]/50' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${originalPercentage + newPercentage === 100 ? 'text-[#006341]' : 'text-red-800'}`}>
                  Total: {originalPercentage + newPercentage}% 
                  {originalPercentage + newPercentage === 100 ? ' ✓' : ' (Must equal 100%)'}
                </span>
              </div>
            </div>
          </div>

          {/* Email Notification Info */}
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2 mb-2">
                <Mail className="h-4 w-4 text-gray-600" />
                <h3 className="font-medium text-gray-900">Email Notification</h3>
              </div>
              <p className="text-sm text-gray-600">
                An email will be sent to {existingProspect.bdName} ({existingProspect.bdEmail}) 
                notifying them about this revenue sharing arrangement.
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-500">
              <span className="text-red-500">*</span> Required fields
            </div>
            <div className="flex space-x-3">
              {onBack && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="h-11 px-6"
                >
                  Back to Form
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-11 px-6"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || totalRevenue <= 0 || originalPercentage + newPercentage !== 100}
                className="h-11 px-8 bg-[#01a64e] hover:bg-[#006341]"
              >
                {loading ? "Processing..." : "Confirm Revenue Split"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
