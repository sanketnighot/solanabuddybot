-- CreateTable
CREATE TABLE "AirdropRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirdropRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AirdropRequest" ADD CONSTRAINT "AirdropRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
