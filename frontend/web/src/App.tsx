import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface GigData {
  id: string;
  title: string;
  employer: string;
  encryptedBudget: string;
  publicDeadline: number;
  publicCategory: string;
  description: string;
  timestamp: number;
  isVerified: boolean;
  decryptedBudget?: number;
}

interface MarketStats {
  totalGigs: number;
  verifiedGigs: number;
  avgBudget: number;
  activeCategories: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [gigs, setGigs] = useState<GigData[]>([]);
  const [filteredGigs, setFilteredGigs] = useState<GigData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingGig, setCreatingGig] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState({ 
    visible: false, 
    status: "pending" as "pending" | "success" | "error", 
    message: "" 
  });
  const [newGigData, setNewGigData] = useState({ 
    title: "", 
    budget: "", 
    deadline: "", 
    category: "development", 
    description: "" 
  });
  const [selectedGig, setSelectedGig] = useState<GigData | null>(null);
  const [userHistory, setUserHistory] = useState<string[]>([]);
  const [marketStats, setMarketStats] = useState<MarketStats>({
    totalGigs: 0,
    verifiedGigs: 0,
    avgBudget: 0,
    activeCategories: 0
  });
  const [showFAQ, setShowFAQ] = useState(false);

  const { initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevm = async () => {
      if (isConnected && !isInitialized) {
        try {
          await initialize();
        } catch (error) {
          console.error('FHEVM init failed:', error);
        }
      }
    };
    initFhevm();
  }, [isConnected, isInitialized, initialize]);

  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected]);

  useEffect(() => {
    filterGigs();
  }, [gigs, searchTerm, categoryFilter]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const gigsList: GigData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          gigsList.push({
            id: businessId,
            title: businessData.name,
            employer: businessData.creator,
            encryptedBudget: businessId,
            publicDeadline: Number(businessData.publicValue1) || 0,
            publicCategory: getCategoryName(Number(businessData.publicValue2) || 0),
            description: businessData.description,
            timestamp: Number(businessData.timestamp),
            isVerified: businessData.isVerified,
            decryptedBudget: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading gig data:', e);
        }
      }
      
      setGigs(gigsList);
      updateMarketStats(gigsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setLoading(false); 
    }
  };

  const filterGigs = () => {
    let filtered = gigs.filter(gig => 
      gig.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      gig.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter(gig => gig.publicCategory === categoryFilter);
    }
    
    setFilteredGigs(filtered);
  };

  const updateMarketStats = (gigsList: GigData[]) => {
    const totalGigs = gigsList.length;
    const verifiedGigs = gigsList.filter(g => g.isVerified).length;
    const avgBudget = gigsList.length > 0 ? 
      gigsList.reduce((sum, g) => sum + (g.decryptedBudget || 0), 0) / gigsList.length : 0;
    const categories = new Set(gigsList.map(g => g.publicCategory)).size;
    
    setMarketStats({ totalGigs, verifiedGigs, avgBudget, activeCategories: categories });
  };

  const createGig = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingGig(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating gig with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract");
      
      const budgetValue = parseInt(newGigData.budget) || 0;
      const gigId = `gig-${Date.now()}`;
      const contractAddress = await contract.getAddress();
      
      const encryptedResult = await encrypt(contractAddress, address, budgetValue);
      
      const tx = await contract.createBusinessData(
        gigId,
        newGigData.title,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newGigData.deadline) || 0,
        getCategoryValue(newGigData.category),
        newGigData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction..." });
      await tx.wait();
      
      setUserHistory(prev => [...prev, `Created gig: ${newGigData.title}`]);
      setTransactionStatus({ visible: true, status: "success", message: "Gig created successfully!" });
      
      await loadData();
      setShowCreateModal(false);
      setNewGigData({ title: "", budget: "", deadline: "", category: "development", description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected") ? "Transaction rejected" : "Creation failed";
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
    } finally { 
      setCreatingGig(false); 
    }
  };

  const decryptBudget = async (gigId: string): Promise<number | null> => {
    if (!isConnected || !address) return null;
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const gigData = await contractRead.getBusinessData(gigId);
      if (gigData.isVerified) {
        return Number(gigData.decryptedValue) || 0;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(gigId);
      const contractAddress = await contractWrite.getAddress();
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(gigId, abiEncodedClearValues, decryptionProof)
      );
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      setUserHistory(prev => [...prev, `Decrypted budget for gig: ${gigId}`]);
      
      await loadData();
      return Number(clearValue);
    } catch (e: any) {
      console.error('Decryption failed:', e);
      return null;
    }
  };

  const testContract = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Contract test failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const getCategoryName = (value: number): string => {
    const categories = ["development", "design", "writing", "marketing", "support"];
    return categories[value] || "other";
  };

  const getCategoryValue = (name: string): number => {
    const categories = ["development", "design", "writing", "marketing", "support"];
    return categories.indexOf(name);
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🔐 FHE Gig Market</h1>
            <p>Privacy-Preserving Freelance Platform</p>
          </div>
          <ConnectButton />
        </header>
        
        <div className="connection-prompt">
          <div className="prompt-content">
            <div className="prompt-icon">🔒</div>
            <h2>Connect Your Wallet</h2>
            <p>Join the world's first fully encrypted freelance marketplace</p>
            <div className="feature-list">
              <div className="feature">✓ Encrypted Budget Bidding</div>
              <div className="feature">✓ Private Proposal System</div>
              <div className="feature">✓ Secure Payment Processing</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="crystal-spinner"></div>
        <p>Loading Encrypted Marketplace...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <h1>💎 FHE Gig Market</h1>
            <span>Zero-Knowledge Freelancing</span>
          </div>
          <nav className="main-nav">
            <button className="nav-btn active">Marketplace</button>
            <button className="nav-btn" onClick={() => setShowFAQ(true)}>FAQ</button>
            <button className="nav-btn" onClick={testContract}>Test FHE</button>
          </nav>
        </div>
        
        <div className="header-right">
          <ConnectButton />
        </div>
      </header>

      <div className="main-content">
        <div className="stats-panel">
          <div className="stat-card">
            <div className="stat-icon">💼</div>
            <div className="stat-info">
              <div className="stat-value">{marketStats.totalGigs}</div>
              <div className="stat-label">Active Gigs</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🔐</div>
            <div className="stat-info">
              <div className="stat-value">{marketStats.verifiedGigs}</div>
              <div className="stat-label">Verified</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-value">${marketStats.avgBudget.toFixed(0)}</div>
              <div className="stat-label">Avg Budget</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value">{marketStats.activeCategories}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        </div>

        <div className="controls-panel">
          <div className="search-section">
            <div className="search-box">
              <input 
                type="text" 
                placeholder="Search gigs..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">🔍</span>
            </div>
            
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="category-filter"
            >
              <option value="all">All Categories</option>
              <option value="development">Development</option>
              <option value="design">Design</option>
              <option value="writing">Writing</option>
              <option value="marketing">Marketing</option>
              <option value="support">Support</option>
            </select>
          </div>
          
          <button 
            className="create-gig-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Post New Gig
          </button>
        </div>

        <div className="gigs-grid">
          {filteredGigs.map((gig) => (
            <div 
              key={gig.id} 
              className="gig-card"
              onClick={() => setSelectedGig(gig)}
            >
              <div className="gig-header">
                <h3 className="gig-title">{gig.title}</h3>
                <span className={`gig-status ${gig.isVerified ? 'verified' : 'encrypted'}`}>
                  {gig.isVerified ? '🔓 Verified' : '🔐 Encrypted'}
                </span>
              </div>
              
              <p className="gig-description">{gig.description}</p>
              
              <div className="gig-details">
                <div className="detail-item">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{gig.publicCategory}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Deadline:</span>
                  <span className="detail-value">{gig.publicDeadline} days</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Budget:</span>
                  <span className="detail-value">
                    {gig.isVerified ? `$${gig.decryptedBudget}` : '🔒 Encrypted'}
                  </span>
                </div>
              </div>
              
              <div className="gig-footer">
                <span className="employer">{gig.employer.substring(0, 8)}...</span>
                <span className="timestamp">
                  {new Date(gig.timestamp * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredGigs.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💎</div>
            <h3>No gigs found</h3>
            <p>Try adjusting your search or create the first gig!</p>
            <button 
              className="create-gig-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Create First Gig
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateGigModal
          gigData={newGigData}
          setGigData={setNewGigData}
          onSubmit={createGig}
          onClose={() => setShowCreateModal(false)}
          creating={creatingGig || isEncrypting}
        />
      )}

      {selectedGig && (
        <GigDetailModal
          gig={selectedGig}
          onClose={() => setSelectedGig(null)}
          onDecrypt={decryptBudget}
          isDecrypting={fheIsDecrypting}
        />
      )}

      {showFAQ && (
        <FAQModal onClose={() => setShowFAQ(false)} />
      )}

      {userHistory.length > 0 && (
        <div className="history-panel">
          <h4>Your Activity</h4>
          <div className="history-list">
            {userHistory.slice(-5).map((item, index) => (
              <div key={index} className="history-item">{item}</div>
            ))}
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className={`transaction-toast ${transactionStatus.status}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {transactionStatus.status === 'success' ? '✓' : 
               transactionStatus.status === 'error' ? '✗' : '⏳'}
            </span>
            {transactionStatus.message}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateGigModal: React.FC<{
  gigData: any;
  setGigData: (data: any) => void;
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
}> = ({ gigData, setGigData, onSubmit, onClose, creating }) => {
  const handleChange = (field: string, value: string) => {
    setGigData({ ...gigData, [field]: value });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Gig</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <span className="fhe-badge">FHE 🔐</span>
            <p>Budget will be encrypted using Zama FHE technology</p>
          </div>
          
          <div className="form-group">
            <label>Gig Title *</label>
            <input
              type="text"
              value={gigData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter gig title..."
            />
          </div>
          
          <div className="form-group">
            <label>Budget (FHE Encrypted) *</label>
            <input
              type="number"
              value={gigData.budget}
              onChange={(e) => handleChange('budget', e.target.value)}
              placeholder="Enter budget in USD..."
              min="0"
            />
            <div className="input-hint">Encrypted on-chain</div>
          </div>
          
          <div className="form-group">
            <label>Deadline (Public) *</label>
            <input
              type="number"
              value={gigData.deadline}
              onChange={(e) => handleChange('deadline', e.target.value)}
              placeholder="Days to complete..."
              min="1"
            />
            <div className="input-hint">Publicly visible</div>
          </div>
          
          <div className="form-group">
            <label>Category *</label>
            <select 
              value={gigData.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <option value="development">Development</option>
              <option value="design">Design</option>
              <option value="writing">Writing</option>
              <option value="marketing">Marketing</option>
              <option value="support">Support</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Description *</label>
            <textarea
              value={gigData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the gig requirements..."
              rows={4}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button 
            onClick={onSubmit}
            disabled={creating || !gigData.title || !gigData.budget || !gigData.deadline}
            className="btn-primary"
          >
            {creating ? 'Encrypting...' : 'Create Gig'}
          </button>
        </div>
      </div>
    </div>
  );
};

const GigDetailModal: React.FC<{
  gig: GigData;
  onClose: () => void;
  onDecrypt: (gigId: string) => Promise<number | null>;
  isDecrypting: boolean;
}> = ({ gig, onClose, onDecrypt, isDecrypting }) => {
  const [decryptedBudget, setDecryptedBudget] = useState<number | null>(null);

  const handleDecrypt = async () => {
    if (gig.isVerified) return;
    
    const budget = await onDecrypt(gig.id);
    if (budget !== null) {
      setDecryptedBudget(budget);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content gig-detail">
        <div className="modal-header">
          <h2>{gig.title}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          <div className="gig-meta">
            <div className="meta-item">
              <span className="meta-label">Category:</span>
              <span className="meta-value">{gig.publicCategory}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Deadline:</span>
              <span className="meta-value">{gig.publicDeadline} days</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Employer:</span>
              <span className="meta-value">{gig.employer}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status:</span>
              <span className={`meta-value ${gig.isVerified ? 'verified' : 'encrypted'}`}>
                {gig.isVerified ? 'Verified' : 'Encrypted'}
              </span>
            </div>
          </div>
          
          <div className="description-section">
            <h3>Description</h3>
            <p>{gig.description}</p>
          </div>
          
          <div className="budget-section">
            <h3>Budget Information</h3>
            <div className="budget-display">
              <div className="budget-amount">
                {gig.isVerified ? `$${gig.decryptedBudget}` : 
                 decryptedBudget ? `$${decryptedBudget}` : '🔒 Encrypted'}
              </div>
              <div className="budget-status">
                {gig.isVerified ? 'On-chain verified' : 
                 decryptedBudget ? 'Locally decrypted' : 'FHE encrypted'}
              </div>
            </div>
            
            {!gig.isVerified && (
              <button 
                onClick={handleDecrypt}
                disabled={isDecrypting}
                className={`decrypt-btn ${decryptedBudget ? 'decrypted' : ''}`}
              >
                {isDecrypting ? 'Decrypting...' : 
                 decryptedBudget ? 'Decrypted' : 'Reveal Budget'}
              </button>
            )}
          </div>
          
          <div className="fhe-explanation">
            <h4>🔐 FHE Protection</h4>
            <p>This budget is encrypted using Fully Homomorphic Encryption. 
               Only authorized parties can decrypt the actual amount while maintaining privacy.</p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button className="btn-primary">Submit Proposal</button>
        </div>
      </div>
    </div>
  );
};

const FAQModal: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const faqs = [
    {
      question: "What is FHE?",
      answer: "Fully Homomorphic Encryption allows computations on encrypted data without decryption."
    },
    {
      question: "How are budgets protected?",
      answer: "All budget amounts are encrypted on-chain using Zama FHE technology."
    },
    {
      question: "Who can see the actual budget?",
      answer: "Only the gig poster and selected freelancers can decrypt the budget amount."
    }
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content faq-modal">
        <div className="modal-header">
          <h2>FHE Gig Market FAQ</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="modal-body">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;


