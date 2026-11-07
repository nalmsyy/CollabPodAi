import { Project } from "@/types/project";

export const INITIAL_DEMO_PROJECTS: Project[] = [
  {
    id: "proj-kualitas-air",
    name: "Penelitian Kualitas Air",
    description:
      "Investigasi kontaminasi mikroplastik dan parameter fisika-kimia air sungai pada Daerah Aliran Sungai (DAS) Brantas Hilir.",
    currentUserRole: "Owner",
    ownerName: "Andi",
    ownerWebId: "https://andi.solidcommunity.net/profile/card#me",
    members: [
      {
        id: "mem-1",
        name: "Andi",
        role: "Owner",
        webId: "https://andi.solidcommunity.net/profile/card#me",
      },
      {
        id: "mem-2",
        name: "Budi",
        role: "Editor",
        webId: "https://budi.solidcommunity.net/profile/card#me",
      },
      {
        id: "mem-3",
        name: "Siti Rahma",
        role: "Viewer",
        webId: "https://siti.solidcommunity.net/profile/card#me",
      },
    ],
    updatedAt: "2 jam yang lalu",
    documentCount: 4,
    isDemo: true,
  },
  {
    id: "proj-ai-medis",
    name: "Tinjauan Pustaka AI Medis",
    description:
      "Sintesis sistematis literatur terkait kepatuhan regulasi privasi data pasien pada sistem diagnostik AI di rumah sakit pendidikan.",
    currentUserRole: "Editor",
    ownerName: "Dr. Hendra",
    ownerWebId: "https://hendra.inrupt.net/profile/card#me",
    members: [
      {
        id: "mem-4",
        name: "Dr. Hendra",
        role: "Owner",
        webId: "https://hendra.inrupt.net/profile/card#me",
      },
      {
        id: "mem-5",
        name: "Andi (Anda)",
        role: "Editor",
        webId: "https://andi.solidcommunity.net/profile/card#me",
      },
      {
        id: "mem-6",
        name: "Dewi Lestari",
        role: "Viewer",
        webId: "https://dewi.inrupt.net/profile/card#me",
      },
    ],
    updatedAt: "Kemarin",
    documentCount: 6,
    isDemo: true,
  },
  {
    id: "proj-perilaku-konsumen",
    name: "Studi Perilaku Konsumen Generasi Z",
    description:
      "Observasi komparatif pengaruh konten edukasi keberlanjutan di media sosial terhadap keputusan konsumsi mahasiswa lintas fakultas.",
    currentUserRole: "Viewer",
    ownerName: "Maya Putri",
    ownerWebId: "https://maya.solidweb.me/profile/card#me",
    members: [
      {
        id: "mem-7",
        name: "Maya Putri",
        role: "Owner",
        webId: "https://maya.solidweb.me/profile/card#me",
      },
      {
        id: "mem-8",
        name: "Fajar Nugraha",
        role: "Editor",
        webId: "https://fajar.solidweb.me/profile/card#me",
      },
      {
        id: "mem-9",
        name: "Andi (Anda)",
        role: "Viewer",
        webId: "https://andi.solidcommunity.net/profile/card#me",
      },
    ],
    updatedAt: "3 hari yang lalu",
    documentCount: 3,
    isDemo: true,
  },
  {
    id: "proj-sensor-iot",
    name: "Sensor IoT Pemantau Kelembapan Tanah",
    description:
      "Pengembangan prototipe mikrokontroler berbasis LoRaWAN hemat daya untuk pemantauan presisi kelembapan tanah sawah tadah hujan.",
    currentUserRole: "Owner",
    ownerName: "Andi",
    ownerWebId: "https://andi.solidcommunity.net/profile/card#me",
    members: [
      {
        id: "mem-10",
        name: "Andi",
        role: "Owner",
        webId: "https://andi.solidcommunity.net/profile/card#me",
      },
      {
        id: "mem-11",
        name: "Farhan Maulana",
        role: "Editor",
        webId: "https://farhan.solidcommunity.net/profile/card#me",
      },
    ],
    updatedAt: "5 hari yang lalu",
    documentCount: 2,
    isDemo: true,
  },
];

