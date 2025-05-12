"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { analyzeImageForAge } from "@/lib/aiAgeChecker"

export default function AgeVerification() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const router = useRouter()

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: ["user", "environment"] }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsCameraActive(true)
        setError(null)
        setPreviewImage(null)
      }
    } catch (err) {
      console.error("Camera error:", err)
      setError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès ou utiliser l'option de téléchargement.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return
    
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error("Impossible d'initialiser le contexte canvas")
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw the video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      // Get the image data
      const imageDataURL = canvas.toDataURL('image/jpeg', 0.8)
      
      // Show preview
      setPreviewImage(imageDataURL)
      stopCamera()
      
    } catch (err) {
      console.error("Capture error:", err)
      setError("Erreur lors de la capture de la photo. Veuillez réessayer.")
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset states
    setError(null)
    setSelectedFile(file)
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Veuillez sélectionner une image valide.")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image est trop volumineuse. Taille maximum: 5MB")
      return
    }

    try {
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        if (event.target?.result) {
          setPreviewImage(event.target.result as string)
        }
      }
      
      reader.onerror = () => {
        throw new Error("Erreur lors de la lecture du fichier")
      }
      
      reader.readAsDataURL(file)
    } catch (err) {
      console.error("Upload error:", err)
      setError("Erreur lors du traitement de l'image. Veuillez réessayer.")
    }
  }

  const processImage = async () => {
    if (!previewImage) return
    
    setIsProcessing(true)
    setError(null)

    try {
      const detectedAge = await analyzeImageForAge(previewImage)
      
      if (detectedAge >= 13 && detectedAge <= 17) {
        await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: previewImage, age: detectedAge }),
        })
        
        alert(`Âge confirmé: ${detectedAge} ans. Redirection vers Discord...`)
        router.push("https://discord.gg/kphrm4ubxQ")
      } else {
        setError(`Désolé, l'âge détecté (${detectedAge} ans) ne correspond pas aux critères requis (13-17 ans).`)
      }
    } catch (err) {
      console.error("Processing error:", err)
      setError("Erreur lors de l'analyse de la photo. Veuillez réessayer.")
    } finally {
      setIsProcessing(false)
      setSelectedFile(null)
    }
  }

  const resetCapture = () => {
    setPreviewImage(null)
    setSelectedFile(null)
    setError(null)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {error && (
        <div className="w-full bg-red-500/20 text-red-200 p-4 rounded-lg text-center">
          {error}
        </div>
      )}
      
      <div className="space-y-6 w-full">
        {previewImage ? (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <img 
                src={previewImage} 
                alt="Photo capturée"
                className="w-full aspect-video object-contain"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={processImage}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 text-lg py-6"
              >
                {isProcessing ? "Traitement..." : "Valider la photo"}
              </Button>
              <Button 
                onClick={resetCapture}
                variant="outline"
                className="text-lg py-6 border-white/20 hover:bg-white/10"
                disabled={isProcessing}
              >
                Reprendre la photo
              </Button>
            </div>
          </div>
        ) : !isCameraActive ? (
          <div className="grid gap-4">
            <Button 
              onClick={startCamera}
              className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
              disabled={isProcessing}
            >
              Utiliser la caméra
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black/40 text-gray-400">ou</span>
              </div>
            </div>

            <div className="bg-black/20 border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
              <div className="space-y-4">
                <p className="text-gray-300">
                  Téléchargez une photo claire de votre visage
                </p>
                
                <div className="flex flex-col items-center gap-4">
                  <Button
                    variant="outline"
                    className="w-full max-w-md text-lg py-6 border-white/20 hover:bg-white/10"
                    onClick={() => document.getElementById("fileInput")?.click()}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      "Traitement en cours..."
                    ) : selectedFile ? (
                      selectedFile.name
                    ) : (
                      "Sélectionner une photo"
                    )}
                  </Button>
                  
                  <input
                    id="fileInput"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </div>

                <p className="text-sm text-gray-400">
                  Formats acceptés: JPG, PNG. Taille maximum: 5MB
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video object-cover"
              />
              <canvas 
                ref={canvasRef}
                className="hidden"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={capturePhoto}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700 text-lg py-6"
              >
                Capturer la photo
              </Button>
              <Button 
                onClick={stopCamera}
                variant="outline"
                className="text-lg py-6 border-white/20 hover:bg-white/10"
              >
                Arrêter la caméra
              </Button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="text-blue-300 text-center animate-pulse text-lg">
            Analyse de la photo en cours...
          </div>
        )}
      </div>
    </div>
  )
}
