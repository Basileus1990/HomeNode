package host

import (
	"context"
	"fmt"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/domain/common/message_types"
	"github.com/Basileus1990/EasyFileTransfer.git/internal/helpers"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"sync"
	"testing"
	"time"
)

// BenchmarkGetResourceMetadata benchmarks the metadata endpoint under high load
func BenchmarkGetResourceMetadata(b *testing.B) {
	tc := setupTestEnvironment(&testing.T{})
	defer tc.server.Close()

	// Connect a host and set up response handler
	hostID, _, hostConn := simulateHostConnection(&testing.T{}, tc)
	defer hostConn.Close()

	metadataPayload := []byte("file-metadata-content-with-some-data")

	// Start goroutine to handle all metadata queries from the host side
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			default:
				hostConn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				_, msg, err := hostConn.ReadMessage()
				if err != nil {
					continue
				}
				queryID := msg[:4]
				msg = msg[4:]

				msgType, err := message_types.GetMsgType(msg)
				if err != nil {
					continue
				}

				if msgType != message_types.MetadataQuery {
					continue
				}

				// Send response
				response := append(queryID, message_types.MetadataResponse.Binary()...)
				response = append(response, metadataPayload...)
				hostConn.WriteMessage(websocket.BinaryMessage, response)
			}
		}
	}()

	resourceID := uuid.New()
	path := "/test/file.txt"
	url := fmt.Sprintf("%s/api/v1/host/metadata/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)

	start := time.Now()
	b.ResetTimer()
	b.ReportAllocs()
	//b.N = 10000
	//b.SetParallelism(128)

	b.Cleanup(func() {
		elapsed := time.Since(start)

		time.Sleep(100 * time.Millisecond)
		fmt.Println("------ Benchmark summary ------")
		fmt.Printf("Total iterations: %d\n", b.N)
		fmt.Printf("Total time: %s\n", elapsed)
		fmt.Printf("Average time per op: %s\n", elapsed/time.Duration(b.N))
		fmt.Printf("Ops per second: %.2f\n", float64(b.N)/elapsed.Seconds())
		fmt.Println("------------------------------")
	})

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Connect as client
			clientConn, _, err := websocket.DefaultDialer.Dial(url, nil)
			if err != nil {
				b.Errorf("Failed to connect: %v", err)
				continue
			}

			// Read response
			clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
			_, msg, err := clientConn.ReadMessage()
			if err != nil {
				b.Errorf("Failed to read response: %v", err)
				clientConn.Close()
				continue
			}

			msgType, err := message_types.GetMsgType(msg)
			if err != nil {
				b.Errorf("Failed to get message type: %v", err)
				clientConn.Close()
				continue
			}

			if msgType != message_types.MetadataResponse {
				b.Errorf("Expected MetadataResponse, got %v", msgType)
			}

			clientConn.Close()
		}
	})

	b.StopTimer()
	cancel()
	wg.Wait()
}

// BenchmarkDownloadResource benchmarks the download endpoint under high load
func BenchmarkDownloadResource(b *testing.B) {
	tc := setupTestEnvironment(&testing.T{})
	defer tc.server.Close()

	// Connect a host
	hostID, _, hostConn := simulateHostConnection(&testing.T{}, tc)
	defer hostConn.Close()

	downloadID := uint32(123)
	chunkData := make([]byte, 8192) // 8KB chunks
	for i := range chunkData {
		chunkData[i] = byte(i % 256)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			default:
				hostConn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				_, msg, err := hostConn.ReadMessage()
				if err != nil {
					continue
				}

				queryID := msg[:4]
				msg = msg[4:]

				msgType, err := message_types.GetMsgType(msg)
				if err != nil {
					continue
				}

				switch msgType {
				case message_types.DownloadInitRequest:
					// Send download init response
					response := append(queryID, message_types.DownloadInitResponse.Binary()...)
					response = append(response, helpers.Uint32ToBinary(downloadID)...)
					response = append(response, []byte("init-payload")...)
					hostConn.WriteMessage(websocket.BinaryMessage, response)

				case message_types.ChunkRequest:
					// Send chunk response
					response := append(queryID, message_types.ChunkResponse.Binary()...)
					response = append(response, chunkData...)
					hostConn.WriteMessage(websocket.BinaryMessage, response)

				case message_types.DownloadCompletionRequest:
					// Send ACK
					response := append(queryID, message_types.ACK.Binary()...)
					hostConn.WriteMessage(websocket.BinaryMessage, response)
				}
			}
		}
	}()

	resourceID := uuid.New()
	path := "/test/file.txt"
	url := fmt.Sprintf("%s/api/v1/host/download/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)

	start := time.Now()
	b.ResetTimer()
	b.ReportAllocs()
	//b.N = 128
	//b.SetParallelism(128)

	b.Cleanup(func() {
		elapsed := time.Since(start)

		time.Sleep(100 * time.Millisecond)
		fmt.Println("------ Benchmark summary ------")
		fmt.Printf("Total iterations: %d\n", b.N)
		fmt.Printf("Total time: %s\n", elapsed)
		fmt.Printf("Average time per op: %s\n", elapsed/time.Duration(b.N))
		fmt.Printf("Ops per second: %.2f\n", float64(b.N)/elapsed.Seconds())
		fmt.Println("------------------------------")
	})

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Connect as client
			clientConn, _, err := websocket.DefaultDialer.Dial(url, nil)
			if err != nil {
				b.Errorf("Failed to connect: %v", err)
				continue
			}

			// Read download init response
			clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
			_, msg, err := clientConn.ReadMessage()
			if err != nil {
				b.Errorf("Failed to read init response: %v", err)
				clientConn.Close()
				continue
			}

			msgType, err := message_types.GetMsgType(msg)
			if err != nil || msgType != message_types.DownloadInitResponse {
				b.Errorf("Expected DownloadInitResponse, got %v", msgType)
				clientConn.Close()
				continue
			}

			// Request 5 chunks
			for i := 0; i < 5; i++ {
				// Send chunk request
				chunkRequest := append(message_types.ChunkRequest.Binary(), helpers.Uint32ToBinary(uint32(i))...)
				err = clientConn.WriteMessage(websocket.BinaryMessage, chunkRequest)
				if err != nil {
					b.Errorf("Failed to send chunk request: %v", err)
					break
				}

				// Read chunk response
				clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
				_, msg, err = clientConn.ReadMessage()
				if err != nil {
					b.Errorf("Failed to read chunk response: %v", err)
					break
				}

				msgType, err = message_types.GetMsgType(msg)
				if err != nil || msgType != message_types.ChunkResponse {
					b.Errorf("Expected ChunkResponse, got %v", msgType)
					break
				}
			}

			// Send download completion
			completionMsg := message_types.DownloadCompletionRequest.Binary()
			clientConn.WriteMessage(websocket.BinaryMessage, completionMsg)

			clientConn.Close()
		}
	})

	b.StopTimer()
	cancel()
	wg.Wait()
}

// BenchmarkLargeFileDownload benchmarks downloading large files with many chunks
func BenchmarkLargeFileDownload(b *testing.B) {
	tc := setupTestEnvironment(&testing.T{})
	defer tc.server.Close()

	hostID, _, hostConn := simulateHostConnection(&testing.T{}, tc)
	defer hostConn.Close()

	downloadID := uint32(999)
	chunkSize := 64 * 1024 // 64KB chunks
	chunkData := make([]byte, chunkSize)
	for i := range chunkData {
		chunkData[i] = byte(i % 256)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			default:
				hostConn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				_, msg, err := hostConn.ReadMessage()
				if err != nil {
					continue
				}

				queryID := msg[:4]
				msg = msg[4:]

				msgType, err := message_types.GetMsgType(msg)
				if err != nil {
					continue
				}

				switch msgType {
				case message_types.DownloadInitRequest:
					response := append(queryID, message_types.DownloadInitResponse.Binary()...)
					response = append(response, helpers.Uint32ToBinary(downloadID)...)
					response = append(response, []byte("large-file-init")...)
					hostConn.WriteMessage(websocket.BinaryMessage, response)

				case message_types.ChunkRequest:
					response := append(queryID, message_types.ChunkResponse.Binary()...)
					response = append(response, chunkData...)
					hostConn.WriteMessage(websocket.BinaryMessage, response)

				case message_types.DownloadCompletionRequest:
					response := append(queryID, message_types.ACK.Binary()...)
					hostConn.WriteMessage(websocket.BinaryMessage, response)
				}
			}
		}
	}()

	resourceID := uuid.New()
	path := "/test/largefile.bin"
	url := fmt.Sprintf("%s/api/v1/host/download/%s/%s%s", tc.wsURL, hostID.String(), resourceID.String(), path)

	// Download 100 chunks (6.4 MB total per iteration)
	numChunks := 100

	start := time.Now()
	b.ResetTimer()
	b.ReportAllocs()
	//b.N = 100
	//b.SetParallelism(b.N)

	b.Cleanup(func() {
		elapsed := time.Since(start)

		time.Sleep(100 * time.Millisecond)
		fmt.Println("------ Benchmark summary ------")
		fmt.Printf("Total iterations: %d\n", b.N)
		fmt.Printf("Total time: %s\n", elapsed)
		fmt.Printf("Average time per op: %s\n", elapsed/time.Duration(b.N))
		fmt.Printf("Ops per second: %.2f\n", float64(b.N)/elapsed.Seconds())
		fmt.Println("------------------------------")
	})

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			clientConn, _, err := websocket.DefaultDialer.Dial(url, nil)
			if err != nil {
				b.Fatalf("Failed to connect: %v", err)
			}

			// Read init response
			clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
			_, _, err = clientConn.ReadMessage()
			if err != nil {
				b.Fatalf("Failed to read init: %v", err)
			}

			// Download chunks
			for j := 0; j < numChunks; j++ {
				chunkRequest := append(message_types.ChunkRequest.Binary(), helpers.Uint32ToBinary(uint32(j))...)
				err = clientConn.WriteMessage(websocket.BinaryMessage, chunkRequest)
				if err != nil {
					b.Fatalf("Failed to send chunk request: %v", err)
				}

				clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
				_, msg, err := clientConn.ReadMessage()
				if err != nil {
					b.Fatalf("Failed to read chunk: %v", err)
				}

				if len(msg) != chunkSize+2 {
					b.Fatalf("Expected chunk size: %d, got: %d", chunkSize, len(msg))
				}
			}

			// Complete download
			completionMsg := message_types.DownloadCompletionRequest.Binary()
			clientConn.WriteMessage(websocket.BinaryMessage, completionMsg)

			clientConn.Close()
		}
	})

	b.StopTimer()
	cancel()
	wg.Wait()
}
