import React, { useState } from 'react';

function GPSImport({ onDataImport }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target.result);
        // 親コンポーネントに読み込んだデータを渡す（必要に応じて）
        if (onDataImport) {
          onDataImport(e.target.result);
        }
      };
      reader.readAsText(file); // テキストファイルとして読み込む（GPXやCSVを想定）
    } else {
      setFileContent('');
      if (onDataImport) {
        onDataImport(null);
      }
    }
  };

  return (
    <div style={gpsImportStyle}>
      <h2>GPSデータインポート</h2>
      <input type="file" accept=".gpx,.tcx,.csv,.txt" onChange={handleFileChange} />
      {selectedFile && (
        <div>
          <h3>選択されたファイル:</h3>
          <p>{selectedFile.name}</p>
        </div>
      )}
      {fileContent && (
        <div>
          <h3>ファイル内容プレビュー:</h3>
          <pre style={previewStyle}>{fileContent.substring(0, 200)}...</pre>
          {fileContent.length > 200 && <p>(ファイルが長いため、最初の200文字を表示しています)</p>}
        </div>
      )}
    </div>
  );
}

const gpsImportStyle = {
  border: '1px solid #ddd',
  padding: '20px',
  margin: '20px',
  borderRadius: '5px',
};

const previewStyle = {
  backgroundColor: '#f8f8f8',
  border: '1px solid #eee',
  padding: '10px',
  whiteSpace: 'pre-wrap', // 改行を保持
  overflowX: 'auto',     // 横スクロール可能
  maxHeight: '200px',
};

export default GPSImport;
