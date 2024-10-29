import { CollectionIncludingMembersAndLinkCount, Member } from "@/types/global";
import getPublicUserData from "./getPublicUserData";
import { toast } from "react-hot-toast";
import { TFunction } from "i18next";
import { User } from "@prisma/client";

const addMemberToCollection = async (
  owner: User,
  memberUsername: string,
  collection: CollectionIncludingMembersAndLinkCount,
  setMember: (newMember: Member) => null | undefined,
  t: TFunction<"translation", undefined>
) => {
  const checkIfMemberAlreadyExists = collection.members.find((e) => {
    const username = (e.user.username || "").toLowerCase();
    const email = (e.user.email || "").toLowerCase();

    return (
      username === memberUsername.toLowerCase() ||
      email === memberUsername.toLowerCase()
    );
  });

  if (
    // no duplicate members
    !checkIfMemberAlreadyExists &&
    // member can't be empty
    memberUsername.trim() !== "" &&
    // member can't be the owner
    memberUsername.trim().toLowerCase() !== owner.username?.toLowerCase() &&
    memberUsername.trim().toLowerCase() !== owner.email?.toLowerCase()
  ) {
    // Lookup, get data/err, list ...
    const user = await getPublicUserData(memberUsername.trim().toLowerCase());

    if (user.username) {
      setMember({
        collectionId: collection.id,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        userId: user.id,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          image: user.image,
        },
      });
    }
  } else if (checkIfMemberAlreadyExists) toast.error(t("user_already_member"));
  else if (
    memberUsername.trim().toLowerCase() === owner.username?.toLowerCase() ||
    memberUsername.trim().toLowerCase() === owner.email?.toLowerCase()
  )
    toast.error(t("you_are_already_collection_owner"));
};

export default addMemberToCollection;
