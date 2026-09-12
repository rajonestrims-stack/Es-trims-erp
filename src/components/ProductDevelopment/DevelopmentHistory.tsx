import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Eye, 
  Edit, 
  Copy, 
  Printer, 
  Download, 
  Trash2, 
  Calendar, 
  Package, 
  FileText,
  Filter,
  CheckCircle2,
  X,
  Sparkles
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile } from '../../types';

interface DevelopmentHistoryProps {
  userProfile: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onLoadCalculationForEdit?: (calcData: any) => void;
}

export const DevelopmentHistory: React.FC<DevelopmentHistoryProps> = ({
  userProfile,
  showToast,
  onLoadCalculationForEdit,
}) => {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCalcDetails, setSelectedCalcDetails] = useState<any | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'product_developments'),
        where('businessId', '==', userProfile.businessId)
      );
      const snap = await getDocs(q);
      const docsData: any[] = [];
      snap.forEach((d) => {
        docsData.push({ id: d.id, ...d.data() });
      });

      // Sort client-side by createdAt descending
      docsData.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });

      setHistoryItems(docsData);
    } catch (err: any) {
      console.error('Error fetching development history:', err);
      showToast('Failed to load history: ' + err.message, 'error');
      try {
        handleFirestoreError(err, OperationType.GET, 'product_developments');
      } catch (e) {
        // Logged by handleFirestoreError
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [userProfile.businessId]);

  const filteredItems = historyItems.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.productName && item.productName.toLowerCase().includes(term)) ||
      (item.productCode && item.productCode.toLowerCase().includes(term)) ||
      (item.calculationNo && item.calculationNo.toLowerCase().includes(term))
    );
  });

  const handleDelete = async (id: string, calcNo: string) => {
    if (!window.confirm(`Are you sure you want to delete calculation ${calcNo}?`)) return;
    try {
      await deleteDoc(doc(db, 'product_developments', id));
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      showToast(`Calculation ${calcNo} deleted.`, 'info');
    } catch (err: any) {
      showToast('Error deleting item: ' + err.message, 'error');
      try {
        handleFirestoreError(err, OperationType.DELETE, `product_developments/${id}`);
      } catch (e) {
        // Logged by handleFirestoreError
      }
    }
  };

  const handleExportHistoryCSV = () => {
    if (historyItems.length === 0) {
      showToast('No history records to export.', 'info');
      return;
    }

    const csvRows = [
      ['Calculation ID', 'Version', 'Product Code', 'Product Name', 'Product Size', 'Paper Size', 'UPS', 'Best Orientation', 'Selected Price', 'Cost / Piece', 'Created By', 'Created Date'],
      ...filteredItems.map((i) => [
        i.calculationNo || i.id,
        `v${i.version || 1}`,
        i.productCode || '',
        i.productName || '',
        `${i.productWidth}x${i.productHeight} ${i.productUnit}`,
        `${i.paperWidth}x${i.paperHeight} ${i.paperUnit}`,
        i.bestUPS || 0,
        i.bestOrientation || 'PORTRAIT',
        i.selectedPrice || 0,
        i.estimatedCostPerPiece ? i.estimatedCostPerPiece.toFixed(4) : 0,
        i.createdByName || i.createdByEmail || '',
        i.createdAt ? new Date(i.createdAt.seconds * 1000).toLocaleDateString() : ''
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Product_Development_History_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Development history exported to CSV', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Development History & Version Control</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review, compare, duplicate or edit previous product development & UPS calculations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchHistory}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-all border border-neutral-200"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportHistoryCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search calculation ID, product code, product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 focus:bg-white focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="text-xs text-neutral-500 font-semibold px-1">
          Showing <strong>{filteredItems.length}</strong> calculation records
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-400">
            <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-xs font-medium">Loading development history records...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-neutral-300" />
            <p className="text-sm font-semibold text-neutral-700">No calculation records found</p>
            <p className="text-xs text-neutral-400">
              Create a new calculation under Product UPS Calculation tab to save history.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 text-neutral-600 font-bold border-b border-neutral-200 uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Calc ID & Version</th>
                  <th className="p-3.5">Product Info</th>
                  <th className="p-3.5">Paper Size</th>
                  <th className="p-3.5 text-center">UPS & Orientation</th>
                  <th className="p-3.5 text-right">Selected Price</th>
                  <th className="p-3.5 text-right">Cost / Piece</th>
                  <th className="p-3.5">Created By</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-purple-50/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-neutral-900">{item.calculationNo || item.id}</div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                        Version {item.version || 1}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-neutral-900">{item.productName || 'Hang Tag'}</div>
                      <div className="text-[11px] text-neutral-500">
                        Code: {item.productCode || 'N/A'} • {item.productWidth}×{item.productHeight} {item.productUnit}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-medium text-neutral-800">{item.paperWidth} × {item.paperHeight} {item.paperUnit}</div>
                      <div className="text-[11px] text-neutral-400">{item.paperPreset || 'Custom'}</div>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="font-extrabold text-sm text-indigo-600">{item.bestUPS} UPS</div>
                      <div className="text-[10px] font-bold uppercase text-neutral-500">{item.bestOrientation}</div>
                    </td>

                    <td className="p-3.5 text-right font-bold">
                      ৳{(item.selectedPrice || 0).toFixed(2)}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="font-black text-emerald-700 text-sm">
                        ৳{(item.estimatedCostPerPiece || 0).toFixed(4)}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-medium text-neutral-800">{item.createdByName || 'User'}</div>
                      <div className="text-[10px] text-neutral-400">
                        {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCalcDetails(item)}
                          className="p-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {onLoadCalculationForEdit && (
                          <button
                            type="button"
                            onClick={() => onLoadCalculationForEdit(item)}
                            className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                            title="Edit / Load into Calculator"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.calculationNo)}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details View Modal */}
      {selectedCalcDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              type="button"
              onClick={() => setSelectedCalcDetails(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {selectedCalcDetails.calculationNo} (v{selectedCalcDetails.version || 1})
                </h3>
                <p className="text-xs text-neutral-500">Saved on {selectedCalcDetails.createdAt ? new Date(selectedCalcDetails.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs border-t border-b border-neutral-100 py-3">
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Product Name:</span>
                <strong className="text-neutral-900">{selectedCalcDetails.productName} ({selectedCalcDetails.productCode})</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Product Size:</span>
                <strong className="text-neutral-900">{selectedCalcDetails.productWidth} × {selectedCalcDetails.productHeight} {selectedCalcDetails.productUnit}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Paper Sheet Size:</span>
                <strong className="text-neutral-900">{selectedCalcDetails.paperWidth} × {selectedCalcDetails.paperHeight} {selectedCalcDetails.paperUnit} ({selectedCalcDetails.paperPreset})</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Gripper & Margins:</span>
                <strong className="text-neutral-900">Gripper {selectedCalcDetails.gripperMm}mm, Gap {selectedCalcDetails.gapMm}mm</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Best Orientation:</span>
                <strong className="text-indigo-600 font-bold">{selectedCalcDetails.bestOrientation} ({selectedCalcDetails.bestColumns} Cols × {selectedCalcDetails.bestRows} Rows)</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Maximum UPS:</span>
                <strong className="text-neutral-900 font-black text-sm">{selectedCalcDetails.bestUPS} UPS</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Paper Utilization:</span>
                <strong className="text-emerald-600 font-bold">{selectedCalcDetails.utilizationPercent ? selectedCalcDetails.utilizationPercent.toFixed(2) : 0}%</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-500">Selected Price:</span>
                <strong className="text-neutral-900">৳{selectedCalcDetails.selectedPrice?.toFixed(2)} ({selectedCalcDetails.priceSource})</strong>
              </div>
              <div className="flex justify-between py-1 bg-emerald-50 p-2 rounded-lg text-emerald-900 font-bold">
                <span>Estimated Cost / Piece:</span>
                <span className="text-sm">৳{selectedCalcDetails.estimatedCostPerPiece?.toFixed(4)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCalcDetails(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200"
              >
                Close
              </button>
              {onLoadCalculationForEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onLoadCalculationForEdit(selectedCalcDetails);
                    setSelectedCalcDetails(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Load into Calculator
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
