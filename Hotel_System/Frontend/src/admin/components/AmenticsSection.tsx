import { useState, useEffect, useRef } from 'react';
import {
  getAmenities,
  createAmenity,
  updateAmenity,
  deleteAmenity,
  type Amenity
} from '../../api/amenticsApi';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  title: string;
  initialValue?: string;
  loading?: boolean;
  error?: string;
}

const AmenityFormModal = ({ visible, onClose, onSave, title, initialValue = '', loading = false, error = '' }: ModalProps) => {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    setName(initialValue);
  }, [initialValue, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Vui lòng nhập tên tiện nghi');
      return;
    }
    try {
      await onSave(name);
      setName('');
      onClose();
    } catch (err) {
      // Error will be shown via error prop
    }
  };

  if (!visible) return null;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button
            type="button"
            style={styles.closeBtn}
            onClick={onClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div style={styles.modalBody}>
          {error && <div style={styles.errorMsg}>{error}</div>}
          <div style={styles.formGroup}>
            <label style={styles.label}>Tên tiện nghi:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên tiện nghi (VD: Wi-Fi, Minibar)"
              style={styles.input}
              maxLength={100}
              disabled={loading}
            />
            <div style={styles.charCount}>{name.length}/100</div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={handleSave}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AmenticsSection = () => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [filteredAmenities, setFilteredAmenities] = useState<Amenity[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
  // Inline edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNameLocal, setEditingNameLocal] = useState<string>('');
  const debounceTimers = useRef<Record<string, number>>({});
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Load amenities on mount
  useEffect(() => {
    loadAmenities();
  }, []);

  // Filter amenities when search text changes
  useEffect(() => {
    if (searchText.trim()) {
      setFilteredAmenities(
        amenities.filter(a =>
          a.tenTienNghi.toLowerCase().includes(searchText.toLowerCase())
        )
      );
    } else {
      setFilteredAmenities(amenities);
    }
  }, [searchText, amenities]);

  const loadAmenities = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAmenities();
      setAmenities(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách tiện nghi');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmenity = async (name: string) => {
    setModalLoading(true);
    setModalError('');
    try {
      await createAmenity(name);
      await loadAmenities();
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi thêm tiện nghi');
      throw err;
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditAmenity = async (name: string) => {
    if (!editingAmenity) return;
    setModalLoading(true);
    setModalError('');
    try {
      await updateAmenity(editingAmenity.idtienNghi, name);
      await loadAmenities();
    } catch (err: any) {
      setModalError(err.message || 'Lỗi khi cập nhật tiện nghi');
      throw err;
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteAmenity = async (id: string) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa tiện nghi này?')) return;

    setLoading(true);
    setError('');
    try {
      await deleteAmenity(id);
      await loadAmenities();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa tiện nghi');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (amenity: Amenity) => {
    // Use inline edit instead of modal: set editing id and local name
    setEditingAmenity(amenity);
    setEditingId(amenity.idtienNghi);
    setEditingNameLocal(amenity.tenTienNghi);
    setModalError('');
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.clearTimeout((showToast as any)._timer);
    (showToast as any)._timer = window.setTimeout(() => setToast(null), 3000);
  };

  const handleInlineNameChange = (id: string, value: string) => {
    setEditingNameLocal(value);
    // optimistic UI update
    setAmenities(prev => prev.map(a => a.idtienNghi === id ? { ...a, tenTienNghi: value } : a));

    // debounce update
    if (debounceTimers.current[id]) window.clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = window.setTimeout(async () => {
      try {
        await updateAmenity(id, value);
        showToast('Cập nhật tiện nghi thành công', 'success');
      } catch (err: any) {
        showToast(err?.message || 'Lỗi khi cập nhật', 'error');
        // revert name by reloading list
        await loadAmenities();
      }
    }, 700) as unknown as number;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={styles.title}>Quản lý Tiện nghi</h1>
          <div style={styles.countBadge}>{amenities.length}</div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Tìm tiện nghi, ví dụ: Wi-Fi"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={styles.searchInput}
            />
            {searchText && (
              <button type="button" onClick={() => setSearchText('')} style={styles.searchClearBtn}>✕</button>
            )}
          </div>

          <button
            type="button"
            style={{ ...styles.btn, ...styles.btnPrimary }}
            onClick={() => {
              setShowAddModal(true);
              setModalError('');
            }}
            disabled={loading}
          >
            + Thêm tiện nghi
          </button>
        </div>
      </div>

      {error && <div style={styles.errorMsg}>{error}</div>}

      {loading && <div style={styles.loadingMsg}>Đang tải...</div>}

      <div style={styles.tableWrapper}>
        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', right: 28, top: 28, zIndex: 1200 }}>
            <div style={{ padding: '10px 14px', borderRadius: 8, color: toast.type === 'error' ? '#7f1d1d' : '#064e3b', background: toast.type === 'error' ? '#fee2e2' : '#ecfdf5', boxShadow: '0 8px 30px rgba(2,6,23,0.08)' }}>{toast.message}</div>
          </div>
        )}
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Mã tiện nghi</th>
              <th style={styles.th}>Tên tiện nghi</th>
              <th style={styles.th}>Số phòng đang sử dụng</th>
              <th style={styles.th}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredAmenities.length === 0 ? (
              <tr>
                <td colSpan={4} style={styles.emptyCell}>
                  {amenities.length === 0 ? 'Chưa có tiện nghi nào' : 'Không tìm thấy tiện nghi'}
                </td>
              </tr>
            ) : (
              filteredAmenities.map((amenity) => (
                <tr key={amenity.idtienNghi} style={styles.tableRow}>
                  <td style={styles.td}>{amenity.idtienNghi}</td>
                  <td style={styles.td}>
                    {editingId === amenity.idtienNghi ? (
                      <input
                        value={editingNameLocal}
                        onChange={(e) => handleInlineNameChange(amenity.idtienNghi, e.target.value)}
                        style={{ ...styles.input, padding: '8px 10px', borderRadius: 8, maxWidth: 420 }}
                      />
                    ) : (
                      amenity.tenTienNghi
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge}>{amenity.roomCount || 0}</span>
                  </td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={{ ...styles.btn, ...styles.btnEdit }}
                      onClick={() => {
                        if (editingId === amenity.idtienNghi) {
                          // stop editing
                          setEditingId(null);
                          setEditingAmenity(null);
                        } else {
                          openEditModal(amenity);
                        }
                      }}
                      disabled={loading}
                    >
                      {editingId === amenity.idtienNghi ? '⏸️ Hoàn tất' : '✎ Sửa'}
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.btn, ...styles.btnDelete }}
                      onClick={() => handleDeleteAmenity(amenity.idtienNghi)}
                      disabled={loading}
                    >
                      ✕ Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AmenityFormModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setModalError('');
        }}
        onSave={handleAddAmenity}
        title="Thêm tiện nghi mới"
        loading={modalLoading}
        error={modalError}
      />

      <AmenityFormModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingAmenity(null);
          setModalError('');
        }}
        onSave={handleEditAmenity}
        title="Cập nhật tiện nghi"
        initialValue={editingAmenity?.tenTienNghi || ''}
        loading={modalLoading}
        error={modalError}
      />
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: '20px',
    gap: '10px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600' as const,
    margin: 0,
    color: '#333'
  },
  searchBox: {
    marginBottom: '20px'
  },
  searchInput: {
    width: '100%',
    maxWidth: '400px',
    padding: '10px 15px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box' as const
  },
  tableWrapper: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 6px 20px rgba(2,6,23,0.04)',
    overflow: 'auto',
    maxHeight: '520px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px'
  },
  tableHeader: {
    backgroundColor: '#2c3e50',
    color: 'white',
    fontWeight: '600' as const,
    position: 'sticky' as const,
    top: 0,
    zIndex: 2
  },
  th: {
    padding: '12px 15px',
    textAlign: 'left' as const,
    fontWeight: '600' as const
  },
  tableRow: {
    borderBottom: '1px solid #f1f5f9',
    backgroundColor: '#fff',
    transition: 'background-color 0.12s, transform 0.12s',
    cursor: 'default'
  },
  tableRowHover: {
    backgroundColor: '#f8fafc'
  },
  td: {
    padding: '12px 15px',
    verticalAlign: 'middle' as const
  },
  badge: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#3498db',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600' as const
  },
  btn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer' as const,
    fontSize: '12px',
    fontWeight: '500' as const,
    marginRight: '8px',
    transition: 'all 0.3s'
  },
  btnPrimary: {
    backgroundColor: '#27ae60',
    color: 'white'
  },
  btnEdit: {
    backgroundColor: '#3498db',
    color: 'white'
  },
  btnDelete: {
    backgroundColor: '#e74c3c',
    color: 'white'
  },
  btnSecondary: {
    backgroundColor: '#95a5a6',
    color: 'white'
  },
  errorMsg: {
    padding: '12px 15px',
    backgroundColor: '#ffe6e6',
    color: '#c0392b',
    borderRadius: '4px',
    marginBottom: '15px',
    border: '1px solid #e74c3c'
  },
  loadingMsg: {
    padding: '12px 15px',
    backgroundColor: '#e8f4f8',
    color: '#2c3e50',
    borderRadius: '4px',
    marginBottom: '15px'
  },
  emptyCell: {
    textAlign: 'center' as const,
    color: '#999',
    fontStyle: 'italic' as const
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 6px 20px rgba(2,6,23,0.06)',
    maxWidth: '540px',
    width: '92%',
    overflow: 'hidden'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  countBadge: {
    background: 'linear-gradient(135deg,#eef2ff,#e0f2fe)',
    color: '#0f172a',
    padding: '6px 10px',
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 13
  },
  searchWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center'
  },
  searchClearBtn: {
    position: 'absolute' as const,
    right: 8,
    top: 6,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280'
  },
  modalHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: '20px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#f9f9f9'
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600' as const,
    color: '#333'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer' as const,
    color: '#666',
    padding: 0,
    width: '30px',
    height: '30px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const
  },
  modalBody: {
    padding: '20px'
  },
  formGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box' as const
  },
  charCount: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
    textAlign: 'right' as const
  },
  modalFooter: {
    display: 'flex' as const,
    justifyContent: 'flex-end' as const,
    gap: '10px',
    padding: '15px 20px',
    borderTop: '1px solid #eee',
    backgroundColor: '#f9f9f9'
  }
};
