import React, { useState } from 'react';
import Tooltip from './Tooltip'; 


// スタイルオブジェクトをコンポーネント内で定義
const gpsImportStyle = {
  border: '1px solid #ddd',
  padding: '20px',
  margin: '20px',
  borderRadius: '5px',
};

/*
const previewStyle = {
  backgroundColor: '#f8f8f8',
  border: '1px solid #eee',
  padding: '10px',
  whiteSpace: 'pre-wrap', // 改行を保持
  overflowX: 'auto',     // 横スクロール可能
  maxHeight: '200px',
};
*/

function GPSImport({ onDataImport, onFileSelected }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        //setFileContent(e.target.result);
        // 親コンポーネントに読み込んだデータとファイル名を渡す
        if (onDataImport) {
          onDataImport(e.target.result, file.name); // ★ ファイル名を第二引数として渡す ★
        }
      };
      reader.readAsText(file); // テキストファイルとして読み込む（GPXやCSVを想定）
    } else {
      //setFileContent('');
      if (onDataImport) {
        onDataImport(null, null); // ファイルが選択されなかった場合は null を渡す
      }
    }
    if (onFileSelected) { // ★ onFileSelected が渡されていれば呼び出す ★
      onFileSelected();
    }
  };

  return (
    <div style={gpsImportStyle}>
      <h2>
        GPXデータインポート
        <Tooltip text={"シミュレーションをするレースのGPXデータをインポートしてください\nレースサイトで配布されるGPXファイルなど"} />
      </h2>
      <input type="file" accept=".gpx,.tcx,.csv,.txt" onChange={handleFileChange} />
      {/*selectedFile && (
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
      )}*/}
    </div>
  );
}

export default GPSImport;